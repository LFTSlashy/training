import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { createApp } from '../src/index.js';
import { config } from '../src/config.js';

let ctx, base, token;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quanta-test-'));

const api = async (method, url, body, tok = token) => {
  const res = await fetch(base + url, {
    method,
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  ctx = createApp({ ...config, port: 0, host: '127.0.0.1', dataDir, historyDays: 400, tickMs: 100, publicDir: path.join(dataDir, 'none') });
  const server = await ctx.start();
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await ctx.stop();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('health is public, data requires auth', async () => {
  assert.equal((await api('GET', '/health', null, null)).status, 200);
  assert.equal((await api('GET', '/quotes', null, null)).status, 401);
});

test('register, login and demo login', async () => {
  const bad = await api('POST', '/auth/register', { username: 'x', password: 'short' }, null);
  assert.equal(bad.status, 400);
  const reg = await api('POST', '/auth/register', { username: 'trader1', password: 'supersecret' }, null);
  assert.equal(reg.status, 200);
  assert.ok(reg.body.token);
  const dup = await api('POST', '/auth/register', { username: 'trader1', password: 'supersecret' }, null);
  assert.equal(dup.status, 409);
  const wrong = await api('POST', '/auth/login', { username: 'trader1', password: 'nope-nope' }, null);
  assert.equal(wrong.status, 401);
  const login = await api('POST', '/auth/login', { username: 'trader1', password: 'supersecret' }, null);
  token = login.body.token;
  const demo = await api('POST', '/auth/login', { username: 'demo', password: 'demo1234' }, null);
  assert.equal(demo.status, 200);
  const me = await api('GET', '/auth/me');
  assert.equal(me.body.user.username, 'trader1');
});

test('market data endpoints', async () => {
  const q = await api('GET', '/quotes?symbols=AAPL,EURUSD');
  assert.ok(q.body.AAPL.ask > q.body.AAPL.bid);
  const h = await api('GET', '/history/AAPL?interval=1D&limit=100');
  assert.equal(h.body.bars.length, 100);
  for (const b of h.body.bars) assert.ok(b.h >= Math.max(b.o, b.c) && b.l <= Math.min(b.o, b.c));
  const m = await api('GET', '/history/BTCUSD?interval=5m&limit=50');
  assert.equal(m.body.bars.length, 50);
  const book = await api('GET', '/book/MSFT');
  assert.ok(book.body.bids[0].price < book.body.asks[0].price);
  assert.ok((await api('GET', '/fundamentals/NVDA')).body.marketCap > 0);
  assert.ok((await api('GET', '/stats/SPX')).body.volatility1y > 0);
  assert.equal((await api('GET', '/search?q=apple')).body[0].symbol, 'AAPL');
  assert.equal((await api('GET', '/history/NOPE')).status, 404);
  const fx = await api('GET', '/fx/matrix');
  assert.equal(fx.body.rates[0][0], 1);
  const corr = await api('GET', '/analytics/correlation?symbols=SPX,NDX,AAPL');
  assert.ok(corr.body.matrix[0][1] > 0.5, 'SPX/NDX should be highly correlated');
  assert.ok((await api('GET', '/curves')).body.US.current.length > 5);
  assert.ok((await api('GET', '/calendar')).body.length > 10);
  assert.ok((await api('GET', '/news?limit=5')).body.length === 5);
  assert.ok((await api('POST', '/screener', { types: ['equity'], minMktCap: 500 })).body.every((r) => r.mktCapUsdBn >= 500));
  assert.ok((await api('GET', '/market/heatmap')).body.length > 3);
  assert.ok((await api('GET', '/market/movers')).body.gainers.length > 0);
});

test('market order fills and updates position and cash', async () => {
  const before = (await api('GET', '/account')).body;
  assert.equal(before.cash, 1_000_000);
  const o = await api('POST', '/orders', { symbol: 'AAPL', side: 'BUY', type: 'MKT', qty: 100 });
  assert.equal(o.status, 200, JSON.stringify(o.body));
  assert.equal(o.body.status, 'FILLED');
  const pos = (await api('GET', '/account/positions')).body;
  const aapl = pos.find((p) => p.symbol === 'AAPL');
  assert.equal(aapl.qty, 100);
  const acct = (await api('GET', '/account')).body;
  assert.ok(Math.abs(acct.cash - (1_000_000 - 100 * o.body.avgFillPrice - 1)) < 0.01);
  // Sell more than we hold -> flips short
  const s = await api('POST', '/orders', { symbol: 'AAPL', side: 'SELL', type: 'MKT', qty: 150 });
  assert.equal(s.body.status, 'FILLED');
  const after = (await api('GET', '/account/positions')).body.find((p) => p.symbol === 'AAPL');
  assert.equal(after.qty, -50);
  const fills = (await api('GET', '/account/fills')).body;
  assert.ok(fills.length >= 2);
  assert.notEqual(fills[0].realized, 0);
});

test('limit orders rest, can be modified and cancelled', async () => {
  const q = (await api('GET', '/quotes?symbols=MSFT')).body.MSFT;
  const o = await api('POST', '/orders', { symbol: 'MSFT', side: 'BUY', type: 'LMT', qty: 10, limitPrice: q.bid * 0.8 });
  assert.equal(o.body.status, 'WORKING');
  const m = await api('PATCH', `/orders/${o.body.id}`, { limitPrice: q.bid * 0.7 });
  assert.ok(m.body.limitPrice < o.body.limitPrice);
  const c = await api('DELETE', `/orders/${o.body.id}`);
  assert.equal(c.body.status, 'CANCELLED');
  const again = await api('DELETE', `/orders/${o.body.id}`);
  assert.equal(again.status, 400);
});

test('marketable limit fills at or better than limit', async () => {
  const q = (await api('GET', '/quotes?symbols=EURUSD')).body.EURUSD;
  const o = await api('POST', '/orders', { symbol: 'EURUSD', side: 'BUY', type: 'LMT', qty: 100000, limitPrice: q.ask * 1.01 });
  assert.equal(o.body.status, 'FILLED');
  assert.ok(o.body.avgFillPrice <= o.body.limitPrice);
});

test('stop validation and risk limits', async () => {
  const q = (await api('GET', '/quotes?symbols=NVDA')).body.NVDA;
  const bad = await api('POST', '/orders', { symbol: 'NVDA', side: 'BUY', type: 'STP', qty: 10, stopPrice: q.bid * 0.5 });
  assert.equal(bad.status, 400);
  const ok = await api('POST', '/orders', { symbol: 'NVDA', side: 'BUY', type: 'STP', qty: 10, stopPrice: q.ask * 1.5 });
  assert.equal(ok.body.status, 'PENDING_TRIGGER');
  const tooBig = await api('POST', '/orders', { symbol: 'SPY', side: 'BUY', type: 'MKT', qty: 100000 });
  assert.equal(tooBig.status, 400);
  assert.match(tooBig.body.error, /buying power/i);
  const vix = await api('POST', '/orders', { symbol: 'VIX', side: 'BUY', type: 'MKT', qty: 1 });
  assert.equal(vix.status, 400);
  const lot = await api('POST', '/orders', { symbol: 'EURUSD', side: 'BUY', type: 'MKT', qty: 1500.5 });
  assert.equal(lot.status, 400);
});

test('risk analytics on portfolio', async () => {
  await api('POST', '/orders', { symbol: 'BTCUSD', side: 'BUY', type: 'MKT', qty: 1 });
  const risk = (await api('GET', '/account/risk')).body;
  assert.ok(risk.var95 > 0);
  assert.ok(risk.var99 >= risk.var95);
  assert.ok(risk.scenarios.length > 3);
  assert.ok(risk.exposures.assetClass.length >= 2);
});

test('alerts trigger and are pushed over websocket', async () => {
  const ws = new WebSocket(base.replace('http', 'ws').replace('/api', '/ws') + `?token=${token}`);
  const messages = [];
  ws.on('message', (m) => messages.push(JSON.parse(m)));
  await new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  ws.send(JSON.stringify({ type: 'sub', channel: 'book', symbol: 'AAPL' }));
  // A resting limit order must be pushed to the client immediately.
  const ko = (await api('GET', '/quotes?symbols=KO')).body.KO;
  const resting = (await api('POST', '/orders', { symbol: 'KO', side: 'BUY', type: 'LMT', qty: 10, limitPrice: ko.bid * 0.8 })).body;
  const q = (await api('GET', '/quotes?symbols=GC1')).body.GC1;
  const a = await api('POST', '/alerts', { symbol: 'GC1', op: '>=', value: q.last * 0.5 });
  assert.equal(a.body.active, true);
  await new Promise((r) => setTimeout(r, 600));
  ws.close();
  const types = new Set(messages.map((m) => m.type));
  for (const t of ['hello', 'quotes', 'book', 'alert', 'order']) assert.ok(types.has(t), `missing ${t} message`);
  assert.ok(messages.some((m) => m.type === 'order' && m.data.id === resting.id && m.data.status === 'WORKING'), 'resting order not pushed');
  const alerts = (await api('GET', '/alerts')).body;
  assert.equal(alerts[0].active, false);
});

test('watchlists persist and are sanitised', async () => {
  const put = await api('PUT', '/watchlists', [{ id: 'a', name: 'Mine', symbols: ['aapl', 'BOGUS', 'MSFT', 'AAPL'] }]);
  assert.deepEqual(put.body[0].symbols, ['AAPL', 'MSFT']);
  assert.deepEqual((await api('GET', '/watchlists')).body[0].symbols, ['AAPL', 'MSFT']);
});

test('ws rejects bad token', async () => {
  const ws = new WebSocket(base.replace('http', 'ws').replace('/api', '/ws') + '?token=bad');
  const code = await new Promise((r) => ws.on('close', (c) => r(c)));
  assert.equal(code, 4401);
});
