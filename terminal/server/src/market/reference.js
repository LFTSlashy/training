import { Rng } from '../lib/rng.js';

const DESCRIPTIONS = {
  Technology: 'designs, develops and sells technology products and services to consumers, enterprises and governments worldwide. Its portfolio spans hardware, software, cloud infrastructure and related services, with a growing contribution from AI-driven offerings.',
  Financials: 'provides a broad range of financial services including banking, asset and wealth management, payments and capital-markets activities to retail, corporate and institutional clients globally.',
  Energy: 'explores, produces, refines and markets crude oil, natural gas and petroleum products, and is expanding its low-carbon solutions portfolio including renewables, hydrogen and carbon capture.',
  'Health Care': 'discovers, develops, manufactures and markets pharmaceutical products, medical devices and healthcare services across therapeutic areas such as oncology, immunology, cardiometabolic and neuroscience.',
  'Consumer Staples': 'manufactures, markets and distributes branded consumer products across food, beverage, household and personal-care categories through a global distribution network.',
  'Consumer Discretionary': 'operates across consumer-facing markets, offering products and services through retail, e-commerce and branded channels to customers worldwide.',
  'Communication Services': 'operates digital platforms and media properties connecting billions of users with content, communications and advertising solutions.',
  Industrials: 'manufactures and services industrial equipment, aerospace and defense systems, and automation solutions for customers in infrastructure, transportation and manufacturing.',
  ETF: 'is an exchange-traded fund that seeks to track the performance of its underlying benchmark index, offering diversified exposure with intraday liquidity.',
};

const CEOS = ['Alex Morgan', 'Priya Natarajan', 'Daniel Becker', 'Mei Lin', 'Carlos Ortega', 'Sophie Laurent', 'James Whitfield', 'Hiro Tanaka', 'Amara Okafor', 'Lukas Schmidt'];
const CITIES = { USD: ['Cupertino, CA', 'Redmond, WA', 'New York, NY', 'Santa Clara, CA', 'Austin, TX', 'Seattle, WA'], EUR: ['Paris, France', 'Walldorf, Germany', 'Veldhoven, Netherlands', 'Munich, Germany'], GBP: ['London, UK'], CHF: ['Vevey, Switzerland'], JPY: ['Tokyo, Japan'], HKD: ['Shenzhen, China'] };

/** Fundamentals & reference data, deterministic per symbol. */
export function fundamentals(engine, symbol) {
  const inst = engine.instrument(symbol);
  if (!inst) return null;
  const q = engine.quote(symbol);
  const r = new Rng(`fa:${symbol}`);
  const base = {
    symbol, name: inst.name, type: inst.type, exchange: inst.exchange, currency: inst.currency, region: inst.region,
    sector: inst.sector, industry: inst.industry,
  };
  if (inst.type !== 'equity' && inst.type !== 'etf') {
    return { ...base, description: describeNonEquity(inst), stats: statsFromHistory(engine, symbol) };
  }

  const shares = (inst.mktCap * 1e9) / inst.price;
  const mktCap = shares * q.last;
  const pe = inst.pe ?? 20;
  const ttmEps = pe > 0 ? inst.price / pe : -(inst.price * 0.03);
  const growth = r.uniform(-0.04, 0.22);
  const netMargin = pe > 0 ? r.uniform(0.12, 0.3) : -r.uniform(0.02, 0.1);
  const ttmNet = ttmEps * shares;
  const ttmRevenue = Math.abs(ttmNet / netMargin);
  const quarters = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3 * i - 1, 1));
    const qn = Math.floor(d.getUTCMonth() / 3) + 1;
    const scale = Math.pow(1 + growth, -i / 4) * r.uniform(0.94, 1.06) / 4;
    const revenue = ttmRevenue * scale;
    const margin = netMargin * r.uniform(0.85, 1.15);
    const eps = (revenue * margin) / shares;
    const est = eps * r.uniform(0.9, 1.06);
    quarters.push({ period: `${d.getUTCFullYear()} Q${qn}`, revenue, grossProfit: revenue * r.uniform(0.35, 0.72), operatingIncome: revenue * (margin + r.uniform(0.03, 0.08)), netIncome: revenue * margin, eps, epsEstimate: est, surprise: ((eps - est) / Math.abs(est)) * 100 });
  }
  const targets = Array.from({ length: 24 }, () => q.last * r.uniform(0.82, 1.38));
  const buys = r.int(10, 40), holds = r.int(3, 15), sells = r.int(0, 6);
  const stats = statsFromHistory(engine, symbol);
  return {
    ...base,
    description: `${inst.name} ${DESCRIPTIONS[inst.sector] || DESCRIPTIONS.Industrials}`,
    ceo: r.pick(CEOS),
    headquarters: r.pick(CITIES[inst.currency] || CITIES.USD),
    employees: Math.round(r.uniform(15, 350)) * 1000,
    founded: r.int(1890, 2005),
    website: `www.${inst.name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}.com`,
    marketCap: mktCap,
    sharesOutstanding: shares,
    floatPct: r.uniform(80, 99.8),
    pe: pe > 0 ? q.last / ttmEps : null,
    forwardPe: pe > 0 ? q.last / (ttmEps * (1 + growth)) : null,
    peg: pe > 0 ? (q.last / ttmEps) / Math.max(1, growth * 100) : null,
    eps: ttmEps,
    priceToBook: r.uniform(1.2, 18),
    priceToSales: mktCap / ttmRevenue,
    evToEbitda: r.uniform(6, 35),
    dividendYield: inst.divYield ?? 0,
    payoutRatio: inst.divYield ? Math.min(95, (inst.divYield / 100) * pe * 100) : 0,
    roe: r.uniform(5, 45),
    roa: r.uniform(2, 18),
    debtToEquity: r.uniform(0.1, 2.5),
    currentRatio: r.uniform(0.8, 3),
    grossMargin: (quarters.at(-1).grossProfit / quarters.at(-1).revenue) * 100,
    operatingMargin: (quarters.at(-1).operatingIncome / quarters.at(-1).revenue) * 100,
    netMargin: netMargin * 100,
    revenueTtm: ttmRevenue,
    revenueGrowth: growth * 100,
    shortInterest: r.uniform(0.5, 6),
    nextEarnings: new Date(Date.now() + r.int(5, 85) * 86_400_000).toISOString().slice(0, 10),
    quarters,
    analyst: {
      buy: buys, hold: holds, sell: sells,
      consensus: buys / (buys + holds + sells) > 0.6 ? 'BUY' : sells > buys ? 'SELL' : 'HOLD',
      targetMean: targets.reduce((a, b) => a + b, 0) / targets.length,
      targetHigh: Math.max(...targets),
      targetLow: Math.min(...targets),
    },
    holders: ['Vanguard Group', 'BlackRock', 'State Street', 'Fidelity (FMR)', 'Geode Capital', 'T. Rowe Price', 'Capital Research', 'Norges Bank'].map((h, i) => ({ name: h, pct: r.uniform(0.6, 9) / (1 + i * 0.25) })).sort((a, b) => b.pct - a.pct),
    stats,
  };
}

function describeNonEquity(inst) {
  switch (inst.type) {
    case 'index': return `${inst.name} is a benchmark equity index tracking ${inst.region} equity market performance. Quoted in ${inst.currency}; tradable here as a cash-settled CFD.`;
    case 'fx': return `${inst.name} spot exchange rate — units of ${inst.currency} per 1 ${inst.base}. Trades 24h over-the-counter; quantities are expressed in base-currency units.`;
    case 'crypto': return `${inst.name} spot price in USD aggregated across major venues. Trades 24/7; fractional quantities allowed.`;
    case 'commodity': return `${inst.name} — front-month contract (${inst.unit}). Contract multiplier ${inst.multiplier.toLocaleString()} units per lot on ${inst.exchange}.`;
    case 'rate': return `${inst.name}: generic on-the-run government bond yield (percent). Changes quoted in basis points.`;
    default: return inst.name;
  }
}

/** Return/risk statistics from daily history. */
export function statsFromHistory(engine, symbol, benchmark = 'SPX') {
  const closes = engine.dailyCloses(symbol, 365);
  const inst = engine.instrument(symbol);
  const abs = inst.process === 'abs';
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(abs ? closes[i] - closes[i - 1] : Math.log(closes[i] / closes[i - 1]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1));
  const bench = engine.dailyCloses(benchmark, 365);
  const brets = [];
  for (let i = 1; i < bench.length; i++) brets.push(Math.log(bench[i] / bench[i - 1]));
  const n = Math.min(rets.length, brets.length);
  const a = rets.slice(-n), b = brets.slice(-n);
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let cov = 0, vb = 0;
  for (let i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); vb += (b[i] - mb) ** 2; }
  let peak = -Infinity, mdd = 0;
  for (const c of closes) { peak = Math.max(peak, c); mdd = Math.min(mdd, abs ? c - peak : c / peak - 1); }
  const last = closes.at(-1);
  const perf = (days) => {
    const p = closes[closes.length - 1 - days];
    if (p === undefined) return null;
    return abs ? (last - p) * 100 : (last / p - 1) * 100;
  };
  const yearCloses = closes.slice(-365);
  return {
    high52w: Math.max(...yearCloses),
    low52w: Math.min(...yearCloses),
    volatility30d: annualSd(rets.slice(-30)) * (abs ? 100 : 100),
    volatility1y: sd * Math.sqrt(365) * 100,
    beta: abs ? null : cov / vb,
    correlation: abs ? null : cov / Math.sqrt(vb * a.reduce((x, y) => x + (y - ma) ** 2, 0)),
    sharpe: abs ? null : (mean * 365 - 0.04) / (sd * Math.sqrt(365)),
    maxDrawdown: abs ? mdd * 100 : mdd * 100,
    perf: { '1D': perf(1), '5D': perf(5), '1M': perf(30), '3M': perf(91), '6M': perf(182), 'YTD': perfYtd(engine, symbol, abs), '1Y': perf(365) },
    unit: abs ? 'bp' : '%',
  };
}

function annualSd(rets) {
  if (rets.length < 2) return 0;
  const m = rets.reduce((a, b) => a + b, 0) / rets.length;
  return Math.sqrt(rets.reduce((a, b) => a + (b - m) ** 2, 0) / (rets.length - 1)) * Math.sqrt(365);
}

function perfYtd(engine, symbol, abs) {
  const bars = engine.history(symbol, '1D', 400);
  const y = new Date().getUTCFullYear();
  const startT = Date.UTC(y, 0, 1) / 1000;
  const first = bars.find((b) => b.t >= startT);
  if (!first) return null;
  const last = bars.at(-1).c;
  return abs ? (last - first.o) * 100 : (last / first.o - 1) * 100;
}

// ── Yield curves ───────────────────────────────────────────────────────
const TENORS = [['1M', 1 / 12], ['3M', 0.25], ['6M', 0.5], ['1Y', 1], ['2Y', 2], ['3Y', 3], ['5Y', 5], ['7Y', 7], ['10Y', 10], ['20Y', 20], ['30Y', 30]];

function interp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points.at(-1)[1];
}

export function yieldCurves(engine) {
  const q = (s) => engine.quote(s);
  const us = [[2, q('USGG2YR')], [5, q('USGG5YR')], [10, q('USGG10YR')], [30, q('USGG30YR')]];
  const policy = 4.875;
  const anchor = (sel) => [[0, policy], ...us.map(([t, qq]) => [t, qq[sel]])];
  const curve = (sel) => TENORS.map(([label, t]) => {
    // front end anchored to the policy rate with a concave roll-down into the 2Y point
    const pts = anchor(sel);
    const y = t < 2 ? policy + (pts[1][1] - policy) * Math.sqrt(t / 2) : interp(pts, t);
    return { tenor: label, years: t, yield: Number(y.toFixed(3)) };
  });
  const cur = curve('last');
  const prev = curve('prevClose');
  const spread = (a, b) => (cur.find((x) => x.tenor === a).yield - cur.find((x) => x.tenor === b).yield) * 100;
  const shift = (country, base, beta, add) => TENORS.map(([label, t], i) => ({ tenor: label, years: t, yield: Number((base + (cur[i].yield - cur[8].yield) * beta + add * Math.log1p(t) / 3.4).toFixed(3)) }));
  return {
    US: { current: cur, previous: prev },
    DE: { current: shift('DE', q('GDBR10').last, 0.6, 0.15) },
    GB: { current: shift('GB', q('GUKG10').last, 0.7, 0.05) },
    JP: { current: shift('JP', q('GJGB10').last, 0.25, 0.6) },
    spreads: { '2s10s': spread('10Y', '2Y'), '5s30s': spread('30Y', '5Y'), '3m10y': spread('10Y', '3M') },
    policyRate: policy,
  };
}

// ── Economic calendar ──────────────────────────────────────────────────
const ECO_EVENTS = [
  ['US', 'Nonfarm Payrolls', 'K', 140, 60, 3], ['US', 'Unemployment Rate', '%', 4.2, 0.1, 3], ['US', 'CPI YoY', '%', 2.5, 0.15, 3],
  ['US', 'Core CPI MoM', '%', 0.3, 0.1, 3], ['US', 'Retail Sales MoM', '%', 0.3, 0.4, 2], ['US', 'ISM Manufacturing PMI', '', 47.5, 1.5, 2],
  ['US', 'ISM Services PMI', '', 51.5, 1.5, 2], ['US', 'Initial Jobless Claims', 'K', 230, 12, 2], ['US', 'GDP QoQ Annualized', '%', 2.8, 0.4, 3],
  ['US', 'FOMC Rate Decision', '%', 4.875, 0, 3], ['US', 'PCE Price Index YoY', '%', 2.3, 0.1, 3], ['US', 'Univ. of Michigan Sentiment', '', 69, 2.5, 1],
  ['US', 'Durable Goods Orders', '%', 0.2, 1.8, 1], ['US', 'Housing Starts', 'M', 1.35, 0.08, 1], ['US', 'JOLTS Job Openings', 'M', 7.7, 0.3, 2],
  ['EZ', 'ECB Deposit Rate', '%', 3.5, 0, 3], ['EZ', 'HICP Flash YoY', '%', 2.0, 0.15, 3], ['EZ', 'HCOB Composite PMI', '', 49.6, 1, 2],
  ['DE', 'Ifo Business Climate', '', 85.4, 1, 2], ['DE', 'ZEW Economic Sentiment', '', 3.6, 6, 1], ['GB', 'CPI YoY', '%', 2.2, 0.15, 3],
  ['GB', 'BoE Bank Rate', '%', 5.0, 0, 3], ['JP', 'BoJ Policy Rate', '%', 0.25, 0, 3], ['JP', 'Tankan Large Mfg', '', 13, 2, 2],
  ['CN', 'Caixin Manufacturing PMI', '', 50.4, 0.8, 2], ['CN', 'GDP YoY', '%', 4.7, 0.2, 3], ['CA', 'Employment Change', 'K', 22, 25, 2],
  ['AU', 'RBA Cash Rate', '%', 4.35, 0, 3], ['CH', 'SNB Policy Rate', '%', 1.0, 0, 2],
];

export function economicCalendar(seed = 1) {
  const today = Math.floor(Date.now() / 86_400_000) * 86_400_000;
  const r = new Rng(seed + Math.floor(today / 86_400_000 / 7));
  const events = [];
  for (let d = -3; d <= 10; d++) {
    const day = today + d * 86_400_000;
    const n = r.int(3, 7);
    const seen = new Set();
    for (let i = 0; i < n; i++) {
      const [country, event, unit, level, sd, importance] = r.pick(ECO_EVENTS);
      if (seen.has(country + event)) continue;
      seen.add(country + event);
      const hour = { US: [12, 14, 18], EZ: [9, 10], DE: [8, 9], GB: [6, 11], JP: [0, 23], CN: [1, 2], CA: [12], AU: [3], CH: [7] }[country];
      const t = day + r.pick(hour) * 3_600_000 + r.pick([0, 15, 30, 45]) * 60_000;
      const prior = level + sd * r.normal() * 0.8;
      const survey = level + sd * r.normal() * 0.5;
      const actual = t < Date.now() ? survey + sd * r.normal() : null;
      const dec = unit === 'K' ? 0 : 2;
      events.push({
        id: `${t}-${country}-${i}`,
        t, country, event, importance, unit,
        survey: sd ? Number(survey.toFixed(dec)) : level,
        prior: sd ? Number(prior.toFixed(dec)) : level,
        actual: actual === null ? null : sd ? Number(actual.toFixed(dec)) : level,
      });
    }
  }
  return events.sort((a, b) => a.t - b.t);
}
