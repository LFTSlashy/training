// Portfolio & cross-asset analytics built on the engine's daily history.

function logReturns(closes, abs) {
  const out = [];
  for (let i = 1; i < closes.length; i++) out.push(abs ? closes[i] - closes[i - 1] : Math.log(closes[i] / closes[i - 1]));
  return out;
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
function stdev(a) {
  const m = mean(a);
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, a.length - 1));
}
function corr(a, b) {
  const n = Math.min(a.length, b.length);
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let c = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    c += (x[i] - mx) * (y[i] - my);
    vx += (x[i] - mx) ** 2;
    vy += (y[i] - my) ** 2;
  }
  return vx && vy ? c / Math.sqrt(vx * vy) : 0;
}
function beta(a, b) {
  const n = Math.min(a.length, b.length);
  const x = a.slice(-n), y = b.slice(-n);
  const mx = mean(x), my = mean(y);
  let c = 0, v = 0;
  for (let i = 0; i < n; i++) { c += (x[i] - mx) * (y[i] - my); v += (y[i] - my) ** 2; }
  return v ? c / v : 0;
}
function percentile(sorted, p) {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function correlationMatrix(engine, symbols, days = 90) {
  const series = symbols.map((s) => {
    const inst = engine.instrument(s);
    return logReturns(engine.dailyCloses(s, days), inst.process === 'abs');
  });
  const matrix = symbols.map((_, i) => symbols.map((__, j) => (i === j ? 1 : Number(corr(series[i], series[j]).toFixed(3)))));
  return { symbols, days, matrix };
}

const SCENARIOS = [
  { id: 'eq-10', name: 'Equity crash −10%', proxy: 'SPX', move: -0.10 },
  { id: 'eq+5', name: 'Equity rally +5%', proxy: 'SPX', move: 0.05 },
  { id: 'tech-15', name: 'Tech selloff −15%', proxy: 'NDX', move: -0.15 },
  { id: 'rates+100', name: 'Rates +100bp (long bonds −15%)', proxy: 'TLT', move: -0.15 },
  { id: 'usd+5', name: 'USD +5% (EURUSD −5%)', proxy: 'EURUSD', move: -0.05 },
  { id: 'oil-25', name: 'Oil shock −25%', proxy: 'CL1', move: -0.25 },
  { id: 'crypto-30', name: 'Crypto winter −30%', proxy: 'BTCUSD', move: -0.30 },
  { id: 'gold+10', name: 'Flight to safety: Gold +10%', proxy: 'GC1', move: 0.10 },
];

export function portfolioRisk(engine, positions, equity, days = 250) {
  const live = positions.filter((p) => Math.abs(p.marketValue) > 1e-6);
  const empty = {
    var95: 0, var99: 0, cvar95: 0, volatility: 0, beta: 0, sharpe: null, exposures: { assetClass: [], sector: [], currency: [], region: [] },
    scenarios: SCENARIOS.map((s) => ({ ...s, pnl: 0, pnlPct: 0 })), contributions: [], histogram: [], worstDay: null, bestDay: null,
  };
  if (!live.length) return empty;

  const rets = new Map();
  for (const p of live) rets.set(p.symbol, logReturns(engine.dailyCloses(p.symbol, days), false));
  const n = Math.min(...[...rets.values()].map((r) => r.length));
  const pnl = Array.from({ length: n }, (_, d) => live.reduce((acc, p) => acc + p.marketValue * (Math.exp(rets.get(p.symbol).slice(-n)[d]) - 1), 0));
  const sorted = [...pnl].sort((a, b) => a - b);
  const var95 = -percentile(sorted, 0.05);
  const var99 = -percentile(sorted, 0.01);
  const tail = sorted.filter((x) => x <= -var95);
  const cvar95 = -mean(tail.length ? tail : [sorted[0]]);
  const vol = stdev(pnl) * Math.sqrt(365);
  const pnlPct = pnl.map((x) => x / Math.max(1, equity));
  const spx = logReturns(engine.dailyCloses('SPX', days), false);

  // Marginal contribution to risk (component VaR via covariance with total P&L)
  const totalVar = stdev(pnl) ** 2;
  const contributions = live.map((p) => {
    const r = rets.get(p.symbol).slice(-n).map((x) => p.marketValue * (Math.exp(x) - 1));
    const m1 = mean(r), m2 = mean(pnl);
    let cov = 0;
    for (let i = 0; i < n; i++) cov += (r[i] - m1) * (pnl[i] - m2);
    cov /= Math.max(1, n - 1);
    return { symbol: p.symbol, pct: totalVar ? (cov / totalVar) * 100 : 0, standaloneVol: stdev(r) * Math.sqrt(365) };
  }).sort((a, b) => b.pct - a.pct);

  const scenarios = SCENARIOS.map((s) => {
    const proxyRets = logReturns(engine.dailyCloses(s.proxy, days), false);
    let total = 0;
    for (const p of live) {
      const b = p.symbol === s.proxy ? 1 : beta(rets.get(p.symbol), proxyRets);
      total += p.marketValue * b * s.move;
    }
    return { ...s, pnl: total, pnlPct: (total / Math.max(1, equity)) * 100 };
  });

  const group = (key) => {
    const m = new Map();
    for (const p of live) {
      const inst = engine.instrument(p.symbol);
      const k = key(inst) || 'Other';
      const cur = m.get(k) || { name: k, long: 0, short: 0 };
      if (p.marketValue >= 0) cur.long += p.marketValue; else cur.short += p.marketValue;
      m.set(k, cur);
    }
    return [...m.values()].map((g) => ({ ...g, net: g.long + g.short, gross: g.long - g.short, pct: ((g.long - g.short) / Math.max(1, equity)) * 100 }))
      .sort((a, b) => b.gross - a.gross);
  };

  // Histogram of daily P&L
  const bins = 24;
  const lo = sorted[0], hi = sorted.at(-1);
  const w = (hi - lo) / bins || 1;
  const histogram = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, count: 0 }));
  for (const x of pnl) histogram[Math.min(bins - 1, Math.floor((x - lo) / w))].count++;

  const sharpe = stdev(pnlPct) ? (mean(pnlPct) * 365 - 0.04) / (stdev(pnlPct) * Math.sqrt(365)) : null;
  return {
    var95, var99, cvar95,
    volatility: vol,
    volatilityPct: (vol / Math.max(1, equity)) * 100,
    beta: beta(pnlPct, spx),
    sharpe,
    exposures: {
      assetClass: group((i) => ({ equity: 'Equity', etf: 'ETF', index: 'Index CFD', fx: 'FX', crypto: 'Crypto', commodity: 'Commodity' }[i.type])),
      sector: group((i) => i.sector || i.group || ({ fx: 'Currencies', crypto: 'Digital Assets', index: 'Indices' }[i.type])),
      currency: group((i) => i.currency),
      region: group((i) => i.region),
    },
    scenarios,
    contributions,
    histogram,
    worstDay: sorted[0],
    bestDay: sorted.at(-1),
    days: n,
  };
}

export function instrumentBetas(engine, symbol, days = 250) {
  const r = logReturns(engine.dailyCloses(symbol, days), engine.instrument(symbol).process === 'abs');
  return ['SPX', 'NDX', 'SX5E', 'NKY', 'EURUSD', 'USGG10YR', 'CL1', 'GC1', 'BTCUSD'].filter((s) => s !== symbol).map((s) => {
    const b = logReturns(engine.dailyCloses(s, days), engine.instrument(s).process === 'abs');
    return { symbol: s, beta: beta(r, b), correlation: corr(r, b) };
  });
}
