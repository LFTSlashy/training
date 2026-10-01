import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MarketEngine } from '../src/market/engine.js';
import { OrderManager } from '../src/trading/oms.js';
import { Store } from '../src/lib/store.js';

const setup = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quanta-oms-'));
  const engine = new MarketEngine({ seed: 5, historyDays: 60 });
  const store = new Store(dir);
  return { engine, oms: new OrderManager(engine, store, { startingCash: 100_000, maxLeverage: 2 }) };
};

test('average cost and realized P&L across partial closes', () => {
  const { engine, oms } = setup();
  const st = engine.state.get('KO');
  const o = { id: 'x', symbol: 'KO', side: 'BUY', qty: 300, filledQty: 0, type: 'MKT', status: 'WORKING' };
  oms.fill('u', o, 100, 50);
  oms.fill('u', o, 200, 53);
  let pos = oms.account('u').positions.KO;
  assert.equal(pos.qty, 300);
  assert.ok(Math.abs(pos.avgPrice - 52) < 1e-9);
  const s = { id: 'y', symbol: 'KO', side: 'SELL', qty: 100, filledQty: 0, type: 'MKT', status: 'WORKING' };
  oms.fill('u', s, 100, 55);
  pos = oms.account('u').positions.KO;
  assert.equal(pos.qty, 200);
  assert.ok(Math.abs(pos.realized - 300) < 1e-9);
  assert.ok(st);
});

test('non-USD instruments convert P&L into USD', () => {
  const { engine, oms } = setup();
  const fx = engine.fxToUsd('EUR');
  const o = { id: 'x', symbol: 'SAP', side: 'BUY', qty: 10, filledQty: 0, type: 'MKT', status: 'WORKING' };
  oms.fill('u', o, 10, 200);
  const acct = oms.account('u');
  const commission = acct.commissions;
  assert.ok(Math.abs(acct.cash - (100_000 - 10 * 200 * fx - commission)) < 1e-6);
});

test('stop order triggers when market crosses', () => {
  const { engine, oms } = setup();
  const q = engine.quote('XOM');
  const order = oms.place('u', { symbol: 'XOM', side: 'SELL', type: 'STP', qty: 10, stopPrice: Number((q.bid - 0.5).toFixed(2)) });
  assert.equal(order.status, 'PENDING_TRIGGER');
  engine.state.get('XOM').mid = q.bid - 1;
  engine.updateSpread(engine.state.get('XOM'));
  oms.onTick();
  assert.equal(order.status, 'FILLED');
  assert.equal(oms.account('u').positions.XOM.qty, -10);
});

test('leverage limit enforced, risk-reducing orders allowed', () => {
  const { oms, engine } = setup();
  const px = engine.quote('SPY').ask;
  const maxQty = Math.floor((100_000 * 2) / px);
  assert.throws(() => oms.place('u', { symbol: 'SPY', side: 'BUY', type: 'MKT', qty: maxQty + 10 }), /buying power/);
  oms.place('u', { symbol: 'SPY', side: 'BUY', type: 'MKT', qty: Math.floor(maxQty * 0.9) });
  assert.doesNotThrow(() => oms.place('u', { symbol: 'SPY', side: 'SELL', type: 'MKT', qty: 10 }));
});

test('IOC limit away from market is cancelled; DAY orders expire on day roll', () => {
  const { oms, engine } = setup();
  const q = engine.quote('JPM');
  const ioc = oms.place('u', { symbol: 'JPM', side: 'BUY', type: 'LMT', tif: 'IOC', qty: 5, limitPrice: q.bid * 0.9 });
  assert.equal(ioc.status, 'CANCELLED');
  const day = oms.place('u', { symbol: 'JPM', side: 'BUY', type: 'LMT', tif: 'DAY', qty: 5, limitPrice: q.bid * 0.9 });
  oms.onTick(Date.now() + 86_400_000);
  assert.equal(day.status, 'EXPIRED');
});
