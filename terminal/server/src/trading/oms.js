import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { dayStart } from '../market/engine.js';

export const ORDER_TYPES = ['MKT', 'LMT', 'STP', 'STP_LMT'];
export const TIFS = ['DAY', 'GTC', 'IOC', 'FOK'];
const OPEN_STATUSES = new Set(['WORKING', 'PARTIAL', 'PENDING_TRIGGER']);
const MAX_HISTORY = 1000;
const EPS = 1e-9;

export class OrderError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const id = (prefix) => `${prefix}${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

/**
 * Paper-trading order management system with a simple but realistic execution model:
 *  - market orders sweep the synthetic L2 book (VWAP across levels => size-dependent slippage)
 *  - resting limit orders fill against the touch when crossed, capped by displayed size (partial fills)
 *  - stops trigger on the touch and convert to market / limit
 *  - multi-currency P&L converted to USD at live FX
 */
export class OrderManager extends EventEmitter {
  constructor(engine, store, { startingCash = 1_000_000, maxLeverage = 4 } = {}) {
    super();
    this.engine = engine;
    this.store = store;
    this.startingCash = startingCash;
    this.maxLeverage = maxLeverage;
    this.day = dayStart(Date.now());
    this.lastSnapshot = 0;
  }

  // ── Accounts ─────────────────────────────────────────────────────────
  account(userId) {
    let acct = this.store.get('accounts', userId);
    if (!acct) {
      acct = this.newAccount(userId);
      this.store.set('accounts', userId, acct);
    }
    return acct;
  }

  newAccount(userId) {
    const now = Date.now();
    return {
      userId,
      currency: 'USD',
      cash: this.startingCash,
      startingCash: this.startingCash,
      commissions: 0,
      realized: 0,
      positions: {},
      orders: [],
      fills: [],
      equityHistory: [{ t: now, equity: this.startingCash }],
      dayStartEquity: this.startingCash,
      dayT: dayStart(now),
      createdAt: now,
    };
  }

  reset(userId) {
    const acct = this.newAccount(userId);
    this.store.set('accounts', userId, acct);
    this.emit('account', userId);
    return acct;
  }

  fx(inst) {
    return this.engine.fxToUsd(inst.currency);
  }

  positionView(pos) {
    const inst = this.engine.instrument(pos.symbol);
    const q = this.engine.quote(pos.symbol);
    const fx = this.fx(inst);
    const mult = inst.multiplier;
    const mark = q.last;
    const marketValue = pos.qty * mark * mult * fx;
    const cost = pos.qty * pos.avgPrice * mult * fx;
    const ref = pos.openedDay === this.day ? pos.avgPrice : q.prevClose;
    return {
      symbol: pos.symbol,
      name: inst.name,
      type: inst.type,
      sector: inst.sector || inst.group || null,
      currency: inst.currency,
      qty: pos.qty,
      avgPrice: pos.avgPrice,
      last: mark,
      changePct: q.changePct,
      marketValue,
      costBasis: cost,
      unrealized: marketValue - cost,
      unrealizedPct: cost ? ((marketValue - cost) / Math.abs(cost)) * 100 : 0,
      dayPnl: pos.qty * (mark - ref) * mult * fx,
      realized: pos.realized,
      openedAt: pos.openedAt,
    };
  }

  summary(userId) {
    const acct = this.account(userId);
    let longValue = 0, shortValue = 0, unrealized = 0, dayPnlPos = 0;
    const positions = Object.values(acct.positions).map((p) => this.positionView(p));
    for (const p of positions) {
      if (p.marketValue >= 0) longValue += p.marketValue; else shortValue += p.marketValue;
      unrealized += p.unrealized;
      dayPnlPos += p.dayPnl;
    }
    const equity = acct.cash + longValue + shortValue;
    const gross = longValue - shortValue;
    const working = acct.orders.filter((o) => OPEN_STATUSES.has(o.status)).length;
    return {
      currency: 'USD',
      cash: acct.cash,
      equity,
      longValue,
      shortValue,
      grossExposure: gross,
      netExposure: longValue + shortValue,
      leverage: equity > 0 ? gross / equity : 0,
      buyingPower: Math.max(0, equity * this.maxLeverage - gross),
      maxLeverage: this.maxLeverage,
      marginUsed: gross / this.maxLeverage,
      unrealized,
      realized: acct.realized,
      commissions: acct.commissions,
      dayPnl: equity - acct.dayStartEquity,
      dayPnlPct: acct.dayStartEquity ? ((equity - acct.dayStartEquity) / acct.dayStartEquity) * 100 : 0,
      totalPnl: equity - acct.startingCash,
      totalPnlPct: ((equity - acct.startingCash) / acct.startingCash) * 100,
      positionCount: positions.length,
      workingOrders: working,
      startingCash: acct.startingCash,
    };
  }

  positions(userId) {
    return Object.values(this.account(userId).positions)
      .map((p) => this.positionView(p))
      .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue));
  }

  orders(userId, { status } = {}) {
    const list = this.account(userId).orders;
    const filtered = status === 'open' ? list.filter((o) => OPEN_STATUSES.has(o.status)) : list;
    return [...filtered].reverse();
  }

  fills(userId, limit = 200) {
    return this.account(userId).fills.slice(-limit).reverse();
  }

  // ── Orders ───────────────────────────────────────────────────────────
  commission(inst, qty, price) {
    const notional = Math.abs(qty) * price * inst.multiplier * this.fx(inst);
    switch (inst.type) {
      case 'equity':
      case 'etf': return Math.max(1, Math.abs(qty) * 0.005 * Math.min(1, this.fx(inst) * 1.2));
      case 'fx': return Math.max(1, notional * 0.2e-4);
      case 'crypto': return Math.max(1, notional * 10e-4);
      case 'commodity': return Math.abs(qty) * 2.25;
      case 'index': return Math.max(1, notional * 0.5e-4);
      default: return Math.max(1, notional * 1e-4);
    }
  }

  validate(userId, input) {
    const symbol = String(input.symbol || '').toUpperCase();
    const inst = this.engine.instrument(symbol);
    if (!inst) throw new OrderError(`Unknown security ${symbol}`);
    if (!inst.tradable) throw new OrderError(`${symbol} is not tradable (reference index / yield)`);
    const side = String(input.side || '').toUpperCase();
    if (side !== 'BUY' && side !== 'SELL') throw new OrderError('Side must be BUY or SELL');
    const type = String(input.type || 'MKT').toUpperCase();
    if (!ORDER_TYPES.includes(type)) throw new OrderError(`Order type must be one of ${ORDER_TYPES.join(', ')}`);
    const tif = String(input.tif || (type === 'MKT' ? 'IOC' : 'DAY')).toUpperCase();
    if (!TIFS.includes(tif)) throw new OrderError(`TIF must be one of ${TIFS.join(', ')}`);
    const qty = Number(input.qty);
    if (!Number.isFinite(qty) || qty <= 0) throw new OrderError('Quantity must be a positive number');
    const lots = qty / inst.lot;
    if (Math.abs(lots - Math.round(lots)) > 1e-6) throw new OrderError(`Quantity must be a multiple of the lot size (${inst.lot})`);
    if (qty > 1e10) throw new OrderError('Quantity too large');

    let limitPrice = null, stopPrice = null;
    if (type === 'LMT' || type === 'STP_LMT') {
      limitPrice = Number(input.limitPrice);
      if (!Number.isFinite(limitPrice) || limitPrice <= 0) throw new OrderError('Limit price required');
    }
    if (type === 'STP' || type === 'STP_LMT') {
      stopPrice = Number(input.stopPrice);
      if (!Number.isFinite(stopPrice) || stopPrice <= 0) throw new OrderError('Stop price required');
      const q = this.engine.quote(symbol);
      if (side === 'BUY' && stopPrice <= q.ask) throw new OrderError(`Buy stop must be above the ask (${q.ask})`);
      if (side === 'SELL' && stopPrice >= q.bid) throw new OrderError(`Sell stop must be below the bid (${q.bid})`);
    }
    const round = (p) => Number((Math.round(p / inst.tick) * inst.tick).toFixed(inst.decimals));
    if (limitPrice !== null) limitPrice = round(limitPrice);
    if (stopPrice !== null) stopPrice = round(stopPrice);

    // Pre-trade risk: projected gross exposure must stay within leverage limit (risk-reducing orders always pass).
    const acct = this.account(userId);
    const sum = this.summary(userId);
    if (sum.equity <= 0) throw new OrderError('Account equity depleted — reset the account to continue');
    const q = this.engine.quote(symbol);
    const pos = acct.positions[symbol]?.qty || 0;
    const signed = side === 'BUY' ? qty : -qty;
    const refPrice = limitPrice ?? (side === 'BUY' ? q.ask : q.bid);
    const unit = refPrice * inst.multiplier * this.fx(inst);
    const pendingSameSide = acct.orders
      .filter((o) => OPEN_STATUSES.has(o.status) && o.symbol === symbol && o.side === side)
      .reduce((a, o) => a + (o.qty - o.filledQty), 0) * (side === 'BUY' ? 1 : -1);
    const after = pos + pendingSameSide + signed;
    const delta = (Math.abs(after) - Math.abs(pos)) * unit;
    if (delta > 0 && sum.grossExposure + delta > sum.equity * this.maxLeverage) {
      throw new OrderError(`Insufficient buying power: requires ${fmtUsd(delta)}, available ${fmtUsd(sum.buyingPower)}`);
    }
    return { symbol, inst, side, type, tif, qty, limitPrice, stopPrice };
  }

  place(userId, input) {
    const v = this.validate(userId, input);
    const acct = this.account(userId);
    const now = Date.now();
    const order = {
      id: id('O'),
      symbol: v.symbol,
      side: v.side,
      type: v.type,
      tif: v.tif,
      qty: v.qty,
      filledQty: 0,
      avgFillPrice: null,
      limitPrice: v.limitPrice,
      stopPrice: v.stopPrice,
      status: v.type === 'STP' || v.type === 'STP_LMT' ? 'PENDING_TRIGGER' : 'WORKING',
      createdAt: now,
      updatedAt: now,
      note: input.note ? String(input.note).slice(0, 80) : undefined,
      reason: null,
    };
    acct.orders.push(order);
    if (acct.orders.length > MAX_HISTORY) acct.orders.splice(0, acct.orders.length - MAX_HISTORY);

    if (order.tif === 'FOK') {
      // Fill-or-kill: only execute if the whole quantity is available now within the limit.
      const avail = this.availableLiquidity(order);
      if (avail + EPS < order.qty) {
        this.finish(userId, order, 'CANCELLED', 'FOK: insufficient liquidity');
        this.store.save();
        return order;
      }
    }
    this.process(userId, order, true);
    this.store.save();
    return order;
  }

  cancel(userId, orderId) {
    const acct = this.account(userId);
    const order = acct.orders.find((o) => o.id === orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (!OPEN_STATUSES.has(order.status)) throw new OrderError(`Order is ${order.status}`);
    this.finish(userId, order, 'CANCELLED', 'Cancelled by user');
    this.store.save();
    return order;
  }

  cancelAll(userId, symbol) {
    const acct = this.account(userId);
    let n = 0;
    for (const o of acct.orders) {
      if (OPEN_STATUSES.has(o.status) && (!symbol || o.symbol === symbol)) {
        this.finish(userId, o, 'CANCELLED', 'Cancelled by user');
        n++;
      }
    }
    this.store.save();
    return n;
  }

  modify(userId, orderId, changes) {
    const acct = this.account(userId);
    const order = acct.orders.find((o) => o.id === orderId);
    if (!order) throw Object.assign(new Error('Order not found'), { status: 404 });
    if (!OPEN_STATUSES.has(order.status)) throw new OrderError(`Order is ${order.status}`);
    const inst = this.engine.instrument(order.symbol);
    const round = (p) => Number((Math.round(p / inst.tick) * inst.tick).toFixed(inst.decimals));
    if (changes.qty !== undefined) {
      const qty = Number(changes.qty);
      if (!(qty > order.filledQty)) throw new OrderError('New quantity must exceed filled quantity');
      order.qty = qty;
    }
    if (changes.limitPrice !== undefined && order.limitPrice !== null) order.limitPrice = round(Number(changes.limitPrice));
    if (changes.stopPrice !== undefined && order.stopPrice !== null && order.status === 'PENDING_TRIGGER') order.stopPrice = round(Number(changes.stopPrice));
    order.updatedAt = Date.now();
    this.emit('order', userId, order);
    this.process(userId, order, false);
    this.store.save();
    return order;
  }

  /** Close (flatten) a position with a market order. */
  flatten(userId, symbol) {
    const pos = this.account(userId).positions[symbol];
    if (!pos || Math.abs(pos.qty) < EPS) throw new OrderError(`No open position in ${symbol}`);
    return this.place(userId, { symbol, side: pos.qty > 0 ? 'SELL' : 'BUY', type: 'MKT', qty: Math.abs(pos.qty), tif: 'IOC' });
  }

  availableLiquidity(order) {
    const book = this.engine.book(order.symbol, 20);
    const levels = order.side === 'BUY' ? book.asks : book.bids;
    const limit = order.type === 'MKT' ? null : order.limitPrice;
    let total = 0;
    for (const l of levels) {
      if (limit !== null && (order.side === 'BUY' ? l.price > limit : l.price < limit)) break;
      total += l.size;
    }
    return total;
  }

  /** Evaluate an order against the current market; `aggressive` = first time (may sweep the book). */
  process(userId, order, aggressive) {
    if (!OPEN_STATUSES.has(order.status)) return;
    const q = this.engine.quote(order.symbol);
    const buy = order.side === 'BUY';

    if (order.status === 'PENDING_TRIGGER') {
      const triggered = buy ? q.ask >= order.stopPrice : q.bid <= order.stopPrice;
      if (!triggered) return;
      order.status = 'WORKING';
      order.triggeredAt = Date.now();
      aggressive = true;
      this.emit('order', userId, order);
    }

    const effectiveType = order.type === 'STP' ? 'MKT' : order.type === 'STP_LMT' ? 'LMT' : order.type;
    const remaining = order.qty - order.filledQty;

    if (effectiveType === 'MKT') {
      const book = this.engine.book(order.symbol, 20);
      const levels = buy ? book.asks : book.bids;
      this.sweep(userId, order, levels, remaining, null);
      if (order.qty - order.filledQty > EPS) {
        // Book exhausted: fill the rest at the last level with additional impact.
        const last = levels.at(-1).price;
        const impact = buy ? 1.0015 : 0.9985;
        this.fill(userId, order, order.qty - order.filledQty, last * impact);
      }
      return;
    }

    // Limit
    const crossable = buy ? q.ask <= order.limitPrice : q.bid >= order.limitPrice;
    if (crossable) {
      if (aggressive) {
        const book = this.engine.book(order.symbol, 20);
        this.sweep(userId, order, buy ? book.asks : book.bids, remaining, order.limitPrice);
      } else {
        // Resting order: price improvement when the market gaps through, capped by touch size.
        const touchSize = buy ? q.askSize : q.bidSize;
        const px = buy ? Math.min(order.limitPrice, q.ask) : Math.max(order.limitPrice, q.bid);
        this.fill(userId, order, Math.min(remaining, Math.max(touchSize, this.engine.instrument(order.symbol).lot)), px);
      }
    }
    if (order.tif === 'IOC' || order.tif === 'FOK') {
      if (OPEN_STATUSES.has(order.status)) this.finish(userId, order, order.filledQty > 0 ? 'FILLED' : 'CANCELLED', 'IOC remainder cancelled');
    }
  }

  sweep(userId, order, levels, qty, limit) {
    let left = qty;
    for (const level of levels) {
      if (left <= EPS) break;
      if (limit !== null && (order.side === 'BUY' ? level.price > limit : level.price < limit)) break;
      const take = Math.min(left, level.size);
      this.fill(userId, order, take, level.price);
      left -= take;
    }
  }

  fill(userId, order, qty, price) {
    if (qty <= EPS) return;
    const inst = this.engine.instrument(order.symbol);
    const lotDecimals = inst.lot < 1 ? Math.ceil(-Math.log10(inst.lot)) : 0;
    qty = Number(qty.toFixed(lotDecimals));
    if (qty <= 0) return;
    price = Number(price.toFixed(inst.decimals + 1));
    const acct = this.account(userId);
    const fx = this.fx(inst);
    const mult = inst.multiplier;
    const signed = order.side === 'BUY' ? qty : -qty;
    const commission = this.commission(inst, qty, price);

    // Position accounting (average-cost, supports flips long<->short)
    let pos = acct.positions[order.symbol];
    let realized = 0;
    if (!pos) {
      pos = { symbol: order.symbol, qty: 0, avgPrice: 0, realized: 0, openedAt: Date.now(), openedDay: this.day };
      acct.positions[order.symbol] = pos;
    }
    if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
      const newQty = pos.qty + signed;
      pos.avgPrice = (pos.avgPrice * Math.abs(pos.qty) + price * qty) / Math.abs(newQty);
      pos.qty = newQty;
    } else {
      const closing = Math.min(Math.abs(pos.qty), qty);
      realized = closing * (price - pos.avgPrice) * Math.sign(pos.qty) * mult * fx;
      const newQty = pos.qty + signed;
      if (Math.abs(newQty) < EPS) {
        pos.qty = 0;
      } else if (Math.sign(newQty) !== Math.sign(pos.qty)) {
        pos.qty = newQty;
        pos.avgPrice = price; // flipped: remainder opens at fill price
        pos.openedAt = Date.now();
        pos.openedDay = this.day;
      } else {
        pos.qty = newQty;
      }
    }
    pos.qty = Number(pos.qty.toFixed(lotDecimals + 2));
    pos.realized += realized;
    acct.realized += realized;
    acct.commissions += commission;
    acct.cash -= signed * price * mult * fx + commission;
    if (Math.abs(pos.qty) < EPS) delete acct.positions[order.symbol];

    order.avgFillPrice = ((order.avgFillPrice ?? 0) * order.filledQty + price * qty) / (order.filledQty + qty);
    order.filledQty = Number((order.filledQty + qty).toFixed(lotDecimals));
    order.updatedAt = Date.now();
    order.status = order.qty - order.filledQty <= EPS ? 'FILLED' : 'PARTIAL';

    const fill = {
      id: id('F'),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      qty,
      price,
      commission,
      realized,
      notionalUsd: qty * price * mult * fx,
      t: Date.now(),
      liquidity: order.type === 'LMT' && order.createdAt < Date.now() - 1 ? 'ADD' : 'REMOVE',
    };
    acct.fills.push(fill);
    if (acct.fills.length > MAX_HISTORY) acct.fills.splice(0, acct.fills.length - MAX_HISTORY);
    this.emit('fill', userId, fill, order);
    this.emit('order', userId, order);
    this.store.save();
  }

  finish(userId, order, status, reason) {
    order.status = status;
    order.reason = reason;
    order.updatedAt = Date.now();
    this.emit('order', userId, order);
  }

  // ── Market loop hook ─────────────────────────────────────────────────
  onTick(now = Date.now()) {
    const today = dayStart(now);
    const newDay = today !== this.day;
    if (newDay) this.day = today;
    const snapshot = now - this.lastSnapshot >= 60_000;
    if (snapshot) this.lastSnapshot = now;

    for (const acct of this.store.all('accounts')) {
      if (newDay) {
        for (const o of acct.orders) if (o.tif === 'DAY' && OPEN_STATUSES.has(o.status)) this.finish(acct.userId, o, 'EXPIRED', 'Day order expired');
        acct.dayStartEquity = this.summary(acct.userId).equity;
        acct.dayT = today;
      }
      for (const o of acct.orders) {
        if (OPEN_STATUSES.has(o.status)) this.process(acct.userId, o, false);
      }
      if (snapshot && (Object.keys(acct.positions).length || acct.equityHistory.length < 2)) {
        acct.equityHistory.push({ t: now, equity: this.summary(acct.userId).equity });
        if (acct.equityHistory.length > 3000) acct.equityHistory.splice(0, acct.equityHistory.length - 3000);
        this.store.save();
      }
    }
  }
}

function fmtUsd(v) {
  return `$${Math.round(v).toLocaleString('en-US')}`;
}
