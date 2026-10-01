import express from 'express';
import { publicUser, httpError } from '../auth.js';
import { fundamentals, statsFromHistory, yieldCurves, economicCalendar } from '../market/reference.js';
import { correlationMatrix, portfolioRisk, instrumentBetas } from '../analytics/risk.js';
import { ASSET_CLASS_LABEL } from '../market/instruments.js';

const FX_CCYS = ['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY', 'HKD'];

/** Simple fixed-window rate limiter for auth endpoints. */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || now - rec.start > windowMs) {
      hits.set(key, { start: now, n: 1 });
      return next();
    }
    if (++rec.n > max) return res.status(429).json({ error: 'Too many attempts, try again later' });
    next();
  };
}

const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined && !res.headersSent) res.json(out);
  } catch (err) {
    next(err);
  }
};

export function apiRouter({ engine, oms, alerts, news, auth, store, config }) {
  const r = express.Router();
  const requireAuth = auth.middleware();
  const describe = (inst) => ({
    symbol: inst.symbol, name: inst.name, type: inst.type, assetClass: ASSET_CLASS_LABEL[inst.type], exchange: inst.exchange,
    currency: inst.currency, base: inst.base, region: inst.region, sector: inst.sector, industry: inst.industry, group: inst.group,
    tick: inst.tick, decimals: inst.decimals, lot: inst.lot, multiplier: inst.multiplier, tradable: inst.tradable, unit: inst.unit,
    tenor: inst.tenor, country: inst.country,
  });
  const sym = (req) => {
    const s = String(req.params.symbol || req.query.symbol || '').toUpperCase();
    if (!engine.has(s)) throw httpError(404, `Unknown security ${s}`);
    return s;
  };

  // Stats are moderately expensive — cache per symbol for 60s.
  const statsCache = new Map();
  const stats = (s) => {
    const hit = statsCache.get(s);
    if (hit && Date.now() - hit.t < 60_000) return hit.v;
    const v = statsFromHistory(engine, s);
    statsCache.set(s, { t: Date.now(), v });
    return v;
  };

  // ── Health & auth ─────────────────────────────────────────────────────
  r.get('/health', wrap(() => ({ ok: true, instruments: engine.universe.size, uptime: process.uptime(), ticks: engine.tickCount })));

  const authLimiter = rateLimit({ windowMs: 60_000, max: 20 });
  r.post('/auth/register', authLimiter, wrap((req) => {
    const user = auth.register(req.body?.username, req.body?.password, req.body?.displayName);
    oms.account(user.id);
    return { token: auth.token(user), user: publicUser(user) };
  }));
  r.post('/auth/login', authLimiter, wrap((req) => {
    const user = auth.login(req.body?.username, req.body?.password);
    return { token: auth.token(user), user: publicUser(user) };
  }));
  r.get('/auth/me', requireAuth, wrap((req) => ({ user: publicUser(req.user) })));
  r.get('/auth/demo', wrap(() => ({ enabled: config.createDemoUser, username: config.createDemoUser ? config.demoUser : null, password: config.createDemoUser ? config.demoPassword : null })));

  // Everything below requires a session.
  r.use(requireAuth);

  // ── Reference & market data ──────────────────────────────────────────
  r.get('/instruments', wrap(() => engine.instruments().map(describe)));
  r.get('/instruments/:symbol', wrap((req) => {
    const s = sym(req);
    return { ...describe(engine.instrument(s)), quote: engine.quote(s) };
  }));
  r.get('/search', wrap((req) => {
    const q = String(req.query.q || '').trim().toUpperCase();
    if (!q) return [];
    const scored = [];
    for (const inst of engine.instruments()) {
      const s = inst.symbol, n = inst.name.toUpperCase();
      let score = 0;
      if (s === q) score = 100;
      else if (s.startsWith(q)) score = 80 - s.length;
      else if (n.startsWith(q)) score = 60;
      else if (n.includes(q)) score = 40;
      else if (s.includes(q)) score = 30;
      if (score) scored.push({ score, ...describe(inst) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, 12);
  }));
  r.get('/quotes', wrap((req) => {
    const list = req.query.symbols ? String(req.query.symbols).toUpperCase().split(',').filter((s) => engine.has(s)) : undefined;
    return engine.quotes(list);
  }));
  r.get('/sparks', wrap((req) => {
    const list = String(req.query.symbols || '').toUpperCase().split(',').filter((s) => engine.has(s)).slice(0, 100);
    const n = Math.min(240, Number(req.query.n) || 60);
    return Object.fromEntries(list.map((s) => [s, engine.spark(s, n)]));
  }));
  r.get('/history/:symbol', wrap((req) => {
    const s = sym(req);
    const interval = ['1m', '5m', '15m', '1h', '1D', '1W', '1M'].includes(req.query.interval) ? req.query.interval : '1D';
    const limit = Math.min(5000, Math.max(10, Number(req.query.limit) || 1000));
    return { symbol: s, interval, bars: engine.history(s, interval, limit) };
  }));
  r.get('/book/:symbol', wrap((req) => engine.book(sym(req), Math.min(25, Number(req.query.depth) || 12))));
  r.get('/trades/:symbol', wrap((req) => engine.tape(sym(req), Math.min(120, Number(req.query.limit) || 60))));
  r.get('/fundamentals/:symbol', wrap((req) => fundamentals(engine, sym(req))));
  r.get('/stats/:symbol', wrap((req) => {
    const s = sym(req);
    return { ...stats(s), betas: instrumentBetas(engine, s) };
  }));
  r.get('/news', wrap((req) => news.list({ symbol: req.query.symbol ? String(req.query.symbol).toUpperCase() : undefined, q: req.query.q, limit: Math.min(300, Number(req.query.limit) || 100) })));
  r.get('/calendar', wrap(() => economicCalendar(config.seed)));
  r.get('/curves', wrap(() => yieldCurves(engine)));

  r.get('/fx/matrix', wrap(() => {
    const rate = (ccy, field) => {
      if (ccy === 'USD') return 1;
      const direct = engine.quote(`${ccy}USD`);
      if (direct) return direct[field];
      const inv = engine.quote(ccy === 'CNY' ? 'USDCNH' : `USD${ccy}`);
      return inv ? 1 / inv[field] : 1;
    };
    const now = FX_CCYS.map((c) => rate(c, 'last'));
    const prev = FX_CCYS.map((c) => rate(c, 'prevClose'));
    return {
      currencies: FX_CCYS,
      rates: FX_CCYS.map((_, i) => FX_CCYS.map((__, j) => now[i] / now[j])),
      changes: FX_CCYS.map((_, i) => FX_CCYS.map((__, j) => ((now[i] / now[j]) / (prev[i] / prev[j]) - 1) * 100)),
    };
  }));

  r.get('/market/movers', wrap((req) => {
    const types = String(req.query.types || 'equity').split(',');
    const rows = engine.instruments().filter((i) => types.includes(i.type)).map((i) => {
      const q = engine.quote(i.symbol);
      return { symbol: i.symbol, name: i.name, last: q.last, change: q.change, changePct: q.changePct, volume: q.volume, turnoverUsd: q.volume * q.vwap * i.multiplier * engine.fxToUsd(i.currency), currency: i.currency };
    });
    const by = (k, dir) => [...rows].sort((a, b) => (b[k] - a[k]) * dir).slice(0, 15);
    return { gainers: by('changePct', 1), losers: by('changePct', -1), active: by('turnoverUsd', 1) };
  }));

  r.get('/market/heatmap', wrap(() => {
    const sectors = new Map();
    for (const i of engine.instruments()) {
      if (i.type !== 'equity') continue;
      const q = engine.quote(i.symbol);
      const cap = (i.mktCap || 10) * (q.last / i.price) * engine.fxToUsd(i.currency);
      const list = sectors.get(i.sector) || [];
      list.push({ symbol: i.symbol, name: i.name, changePct: q.changePct, last: q.last, capUsdBn: cap, region: i.region });
      sectors.set(i.sector, list);
    }
    return [...sectors.entries()].map(([sector, items]) => {
      const total = items.reduce((a, b) => a + b.capUsdBn, 0);
      return { sector, capUsdBn: total, changePct: items.reduce((a, b) => a + b.changePct * b.capUsdBn, 0) / total, items: items.sort((a, b) => b.capUsdBn - a.capUsdBn) };
    }).sort((a, b) => b.capUsdBn - a.capUsdBn);
  }));

  r.post('/screener', wrap((req) => {
    const f = req.body || {};
    const inSet = (arr, v) => !Array.isArray(arr) || !arr.length || arr.includes(v);
    const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const rows = [];
    for (const i of engine.instruments()) {
      if (!inSet(f.types, i.type) || !inSet(f.sectors, i.sector) || !inSet(f.regions, i.region)) continue;
      const q = engine.quote(i.symbol);
      const st = stats(i.symbol);
      const mktCapUsd = i.mktCap ? i.mktCap * (q.last / i.price) * engine.fxToUsd(i.currency) : null;
      const row = {
        symbol: i.symbol, name: i.name, type: i.type, sector: i.sector || i.group || null, region: i.region, currency: i.currency,
        last: q.last, changePct: q.changePct, volume: q.volume, mktCapUsdBn: mktCapUsd,
        pe: i.pe && i.pe > 0 ? (i.pe * q.last) / i.price : null, divYield: i.divYield ?? null,
        perf1M: st.perf['1M'], perfYtd: st.perf.YTD, perf1Y: st.perf['1Y'], vol1Y: st.volatility1y, beta: st.beta, unit: st.unit,
        pctFrom52wHigh: ((q.last / st.high52w) - 1) * 100,
      };
      const checks = [
        [num(f.minChange), (v) => row.changePct >= v], [num(f.maxChange), (v) => row.changePct <= v],
        [num(f.minMktCap), (v) => (row.mktCapUsdBn ?? 0) >= v], [num(f.maxPe), (v) => row.pe !== null && row.pe <= v],
        [num(f.minPe), (v) => row.pe !== null && row.pe >= v], [num(f.minDivYield), (v) => (row.divYield ?? 0) >= v],
        [num(f.minPerfYtd), (v) => (row.perfYtd ?? -Infinity) >= v], [num(f.maxVol), (v) => row.vol1Y <= v],
        [num(f.maxBeta), (v) => row.beta !== null && row.beta <= v], [num(f.minBeta), (v) => row.beta !== null && row.beta >= v],
      ];
      if (checks.every(([v, fn]) => v === null || fn(v))) rows.push(row);
    }
    const sortKey = typeof f.sort === 'string' ? f.sort : 'mktCapUsdBn';
    const dir = f.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => ((a[sortKey] ?? -Infinity) > (b[sortKey] ?? -Infinity) ? 1 : -1) * dir);
    return rows.slice(0, Math.min(200, Number(f.limit) || 100));
  }));

  r.get('/analytics/correlation', wrap((req) => {
    const list = String(req.query.symbols || 'SPX,NDX,SX5E,NKY,EURUSD,USDJPY,GC1,CL1,BTCUSD,USGG10YR').toUpperCase().split(',').filter((s) => engine.has(s)).slice(0, 20);
    const days = Math.min(365, Math.max(20, Number(req.query.days) || 90));
    return correlationMatrix(engine, list, days);
  }));

  // ── Account / trading ─────────────────────────────────────────────────
  r.get('/account', wrap((req) => oms.summary(req.user.id)));
  r.get('/account/positions', wrap((req) => oms.positions(req.user.id)));
  r.get('/account/orders', wrap((req) => oms.orders(req.user.id, { status: req.query.status })));
  r.get('/account/fills', wrap((req) => oms.fills(req.user.id, Math.min(1000, Number(req.query.limit) || 200))));
  r.get('/account/equity', wrap((req) => oms.account(req.user.id).equityHistory));
  r.get('/account/risk', wrap((req) => {
    const s = oms.summary(req.user.id);
    return portfolioRisk(engine, oms.positions(req.user.id), s.equity);
  }));
  r.post('/account/reset', wrap((req) => {
    oms.reset(req.user.id);
    return oms.summary(req.user.id);
  }));
  r.post('/orders', wrap((req) => oms.place(req.user.id, req.body || {})));
  r.patch('/orders/:id', wrap((req) => oms.modify(req.user.id, req.params.id, req.body || {})));
  r.delete('/orders/:id', wrap((req) => oms.cancel(req.user.id, req.params.id)));
  r.post('/orders/cancel-all', wrap((req) => ({ cancelled: oms.cancelAll(req.user.id, req.body?.symbol) })));
  r.post('/positions/:symbol/close', wrap((req) => oms.flatten(req.user.id, sym(req))));

  // ── Watchlists, alerts, layouts ─────────────────────────────────────────
  const defaultWatchlists = () => [
    { id: 'core', name: 'Core', symbols: ['SPX', 'NDX', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'JPM', 'EURUSD', 'USDJPY', 'BTCUSD', 'GC1', 'CL1', 'USGG10YR'] },
    { id: 'tech', name: 'Tech', symbols: ['AAPL', 'MSFT', 'NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'ORCL', 'CRM', 'INTC', 'SAP', '6758'] },
    { id: 'macro', name: 'Macro', symbols: ['SPX', 'SX5E', 'NKY', 'VIX', 'USGG2YR', 'USGG10YR', 'GDBR10', 'EURUSD', 'USDJPY', 'GC1', 'CO1', 'HG1'] },
  ];
  r.get('/watchlists', wrap((req) => store.get('watchlists', req.user.id) || defaultWatchlists()));
  r.put('/watchlists', wrap((req) => {
    const lists = Array.isArray(req.body) ? req.body : null;
    if (!lists || lists.length > 30) throw httpError(400, 'Expected an array of up to 30 watchlists');
    const clean = lists.map((l, i) => ({
      id: String(l.id || `wl${i}`).slice(0, 40),
      name: String(l.name || `List ${i + 1}`).slice(0, 40),
      symbols: [...new Set((Array.isArray(l.symbols) ? l.symbols : []).map((s) => String(s).toUpperCase()).filter((s) => engine.has(s)))].slice(0, 200),
    }));
    store.set('watchlists', req.user.id, clean);
    return clean;
  }));
  r.get('/alerts', wrap((req) => alerts.list(req.user.id)));
  r.post('/alerts', wrap((req) => alerts.create(req.user.id, req.body || {})));
  r.post('/alerts/:id/rearm', wrap((req) => alerts.rearm(req.user.id, req.params.id)));
  r.delete('/alerts/:id', wrap((req) => {
    alerts.remove(req.user.id, req.params.id);
    return { ok: true };
  }));
  r.get('/layout', wrap((req) => store.get('layouts', req.user.id) || null));
  r.put('/layout', wrap((req) => {
    const body = JSON.stringify(req.body ?? null);
    if (body.length > 50_000) throw httpError(413, 'Layout too large');
    store.set('layouts', req.user.id, req.body);
    return { ok: true };
  }));

  return r;
}
