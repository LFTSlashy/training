import { Rng } from '../lib/rng.js';

const EQUITY_TEMPLATES = [
  { s: 1, k: 'EARNINGS', t: '{name} Q{q} EPS beats estimates by {pct}%; revenue {rev} vs consensus', impact: [0.015, 0.05] },
  { s: -1, k: 'EARNINGS', t: '{name} Q{q} results miss expectations, shares slide in late trading', impact: [-0.06, -0.015] },
  { s: 1, k: 'GUIDANCE', t: '{name} raises full-year guidance on strong {segment} demand', impact: [0.01, 0.04] },
  { s: -1, k: 'GUIDANCE', t: '{name} cuts outlook, cites softer {segment} trends and FX headwinds', impact: [-0.045, -0.012] },
  { s: 1, k: 'ANALYST', t: '{broker} upgrades {sym} to Overweight, PT raised to {pt}', impact: [0.005, 0.02] },
  { s: -1, k: 'ANALYST', t: '{broker} downgrades {sym} to Underweight on valuation; PT {pt}', impact: [-0.02, -0.005] },
  { s: 0, k: 'ANALYST', t: '{broker} initiates coverage on {name} at Equal-Weight', impact: [-0.002, 0.002] },
  { s: 1, k: 'M&A', t: '{name} said to explore acquisition of {target} in ${deal}bn deal — sources', impact: [-0.01, 0.02] },
  { s: 1, k: 'CORPORATE', t: '{name} announces ${buyback}bn share buyback programme', impact: [0.006, 0.02] },
  { s: 0, k: 'CORPORATE', t: '{name} CEO to present at {conf} investor conference', impact: [-0.002, 0.002] },
  { s: -1, k: 'REGULATORY', t: '{regulator} opens probe into {name} {issue} practices', impact: [-0.035, -0.008] },
  { s: 1, k: 'PRODUCT', t: '{name} unveils next-generation {product}; early reviews positive', impact: [0.004, 0.018] },
  { s: -1, k: 'SUPPLY', t: '{name} flags supply-chain disruption affecting {segment} shipments', impact: [-0.025, -0.006] },
  { s: 1, k: 'FLOW', t: 'Unusual call activity in {sym}: {calls}k contracts traded vs 20d avg {avg}k', impact: [0.002, 0.01] },
  { s: -1, k: 'FLOW', t: '{sym} block trade: {blk}m shares crossed at discount to last', impact: [-0.01, -0.002] },
];

const MACRO_TEMPLATES = [
  { s: 1, k: 'CENTRAL BANK', t: 'Fed\'s {fed} says policy "well positioned", sees room for gradual cuts', factor: [['RATES', -0.6], ['EQ', 0.3], ['USD', -0.3]] },
  { s: -1, k: 'CENTRAL BANK', t: 'Fed\'s {fed}: inflation progress "uneven", no rush to ease further', factor: [['RATES', 0.7], ['EQ', -0.3], ['USD', 0.4]] },
  { s: 0, k: 'CENTRAL BANK', t: 'ECB\'s {ecb} signals data-dependent approach ahead of next meeting', factor: [['EU', 0.1]] },
  { s: -1, k: 'MACRO', t: 'US weekly jobless claims rise to {claims}k, highest since {month}', factor: [['RATES', -0.4], ['EQ', -0.2], ['USD', -0.2]] },
  { s: 1, k: 'MACRO', t: 'China announces fresh stimulus package targeting property and consumption', factor: [['ASIA', 1.4], ['METAL', 0.8], ['EQ', 0.2]] },
  { s: -1, k: 'GEOPOLITICS', t: 'Tensions escalate in {region}; oil jumps, havens bid', factor: [['OIL', 1.2], ['EQ', -0.4], ['METAL', 0.6], ['VOL', 0.8]] },
  { s: 1, k: 'ENERGY', t: 'OPEC+ delegates signal output increase delay; crude extends gains', factor: [['OIL', 1.0]] },
  { s: -1, k: 'ENERGY', t: 'US crude inventories build by {inv}m barrels vs expected draw', factor: [['OIL', -0.8]] },
  { s: 1, k: 'CRYPTO', t: 'Spot crypto ETFs record ${flows}m net inflows, extending streak', factor: [['CRYPTO', 0.9]] },
  { s: -1, k: 'CRYPTO', t: 'Major exchange halts withdrawals temporarily citing "technical issues"', factor: [['CRYPTO', -1.2]] },
  { s: 0, k: 'TREASURIES', t: 'US Treasury {tenor}-year auction tails by {tail}bp; bid-to-cover {btc}', factor: [['RATES', 0.3]] },
  { s: 1, k: 'MARKETS', t: 'Global equities extend rally as volatility sellers return', factor: [['EQ', 0.5], ['VOL', -0.6]] },
  { s: -1, k: 'MARKETS', t: 'Risk-off: stocks slide as investors reassess growth outlook', factor: [['EQ', -0.6], ['VOL', 0.7], ['RATES', -0.3]] },
  { s: 0, k: 'FX', t: 'BOJ officials watching FX moves "with a sense of urgency"', factor: [['USD', -0.4]] },
  { s: 1, k: 'COMMODITIES', t: 'Gold sets fresh record as central bank buying accelerates', factor: [['METAL', 0.9]] },
  { s: -1, k: 'AGRICULTURE', t: 'USDA raises crop yield estimates; grains under pressure', factor: [['AGS', -1.0]] },
];

const BROKERS = ['Goldman Sachs', 'Morgan Stanley', 'JPMorgan', 'BofA Securities', 'Citi', 'UBS', 'Barclays', 'Deutsche Bank', 'Jefferies', 'Bernstein', 'Evercore ISI', 'BNP Paribas'];
const SOURCES = ['QNT', 'Reuters', 'Dow Jones', 'FT', 'WSJ', 'Nikkei', 'Bloomberg Intelligence', 'MarketWatch', 'CNBC', 'Barron\'s'];
const SEGMENTS = ['cloud', 'data center', 'consumer', 'enterprise', 'advertising', 'China', 'services', 'automotive', 'wealth management'];
const PRODUCTS = ['AI accelerator', 'flagship device', 'software platform', 'cloud region', 'subscription tier', 'chip architecture'];
const REGULATORS = ['SEC', 'FTC', 'DOJ', 'European Commission', 'CMA', 'FCA'];
const ISSUES = ['pricing', 'data privacy', 'disclosure', 'competition', 'accounting'];
const CONFS = ['Goldman Sachs Communacopia', 'JPMorgan Healthcare', 'Morgan Stanley TMT', 'Barclays Global Financial', 'BofA Global Technology'];
const FED = ['Waller', 'Williams', 'Bowman', 'Logan', 'Goolsbee', 'Kashkari', 'Daly', 'Barkin'];
const ECB = ['Lagarde', 'Schnabel', 'Lane', 'Nagel', 'Villeroy'];
const REGIONS = ['the Middle East', 'Eastern Europe', 'the South China Sea', 'the Red Sea'];
const MONTHS = ['January', 'March', 'May', 'August', 'last summer'];
const TARGETS = ['a cybersecurity start-up', 'a European peer', 'a data analytics firm', 'a mid-cap rival', 'a chip designer'];

let seq = 0;
const CCY_SYMBOL = { USD: '$', EUR: '€', GBP: '£', JPY: '¥', CHF: 'CHF ', HKD: 'HK$' };

export class NewsWire {
  constructor(engine, { seed = 1 } = {}) {
    this.engine = engine;
    this.rng = new Rng(seed + 99);
    this.items = [];
    this.timer = null;
    this.equities = engine.instruments().filter((i) => i.type === 'equity');
    this.backfill(120);
  }

  fill(template, inst) {
    const r = this.rng;
    const q = engine_quarter();
    const price = inst ? this.engine.quote(inst.symbol)?.last ?? inst.price : 0;
    const vars = {
      name: inst?.name, sym: inst?.symbol, q,
      pct: r.int(2, 18), rev: `$${(r.uniform(5, 120)).toFixed(1)}bn`,
      segment: r.pick(SEGMENTS), broker: r.pick(BROKERS), pt: `${CCY_SYMBOL[inst?.currency] ?? ''}${Math.round(price * r.uniform(0.8, 1.3)).toLocaleString('en-US')}`,
      target: r.pick(TARGETS), deal: r.int(2, 40), buyback: r.int(5, 60), conf: r.pick(CONFS),
      regulator: r.pick(REGULATORS), issue: r.pick(ISSUES), product: r.pick(PRODUCTS),
      calls: r.int(40, 400), avg: r.int(10, 80), blk: (r.uniform(0.5, 6)).toFixed(1),
      fed: r.pick(FED), ecb: r.pick(ECB), claims: r.int(215, 265), month: r.pick(MONTHS), region: r.pick(REGIONS),
      inv: (r.uniform(1, 7)).toFixed(1), flows: r.int(150, 1200), tenor: r.pick([2, 5, 7, 10, 20, 30]), tail: (r.uniform(0.2, 2.5)).toFixed(1), btc: (r.uniform(2.2, 2.8)).toFixed(2),
    };
    return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
  }

  generate(t, applyImpact) {
    const r = this.rng;
    const macro = r.chance(0.35);
    let item;
    if (macro) {
      const tpl = r.pick(MACRO_TEMPLATES);
      const tickers = new Set();
      for (const [f] of tpl.factor) {
        const map = { RATES: ['USGG10YR', 'TLT'], EQ: ['SPX'], USD: ['EURUSD', 'USDJPY'], OIL: ['CL1', 'CO1'], CRYPTO: ['BTCUSD', 'ETHUSD'], METAL: ['GC1'], ASIA: ['HSI', 'SHCOMP'], AGS: ['C1', 'W1'], EU: ['SX5E'], VOL: ['VIX'] }[f] || [];
        map.forEach((s) => tickers.add(s));
      }
      item = { headline: this.fill(tpl.t), category: tpl.k, sentiment: tpl.s, tickers: [...tickers], macro: true };
      if (applyImpact) for (const [f, sig] of tpl.factor) this.engine.factorShock(f, sig * r.uniform(0.5, 1.2));
    } else {
      const inst = r.pick(this.equities);
      const tpl = r.pick(EQUITY_TEMPLATES);
      item = { headline: this.fill(tpl.t, inst), category: tpl.k, sentiment: tpl.s, tickers: [inst.symbol], macro: false };
      if (applyImpact) this.engine.shock(inst.symbol, r.uniform(tpl.impact[0], tpl.impact[1]) * 0.6);
    }
    item.id = `N${Date.now().toString(36)}${(seq++).toString(36)}`;
    item.t = t;
    item.source = r.pick(SOURCES);
    item.urgent = r.chance(0.12);
    item.body = this.body(item);
    return item;
  }

  body(item) {
    const lines = [
      `${item.headline}.`,
      item.macro
        ? 'Market participants are reassessing positioning across asset classes following the report. Desk commentary points to elevated volumes in index futures and front-end rates.'
        : `Shares of ${item.tickers[0]} reacted in electronic trading as investors digested the update. Options markets implied a larger-than-usual move into the session.`,
      'Analysts cautioned that follow-through will depend on upcoming data and management commentary.',
      `(Reporting by QUANTA News Desk; editing by ${this.rng.pick(['M. Laurent', 'S. Okafor', 'J. Chen', 'A. Rossi', 'K. Müller'])})`,
    ];
    return lines.join('\n\n');
  }

  backfill(n) {
    const now = Date.now();
    for (let i = n; i > 0; i--) {
      const t = now - i * this.rng.uniform(60_000, 240_000);
      this.items.push(this.generate(t, false));
    }
    this.items.sort((a, b) => a.t - b.t);
  }

  start(onItem) {
    const schedule = () => {
      this.timer = setTimeout(() => {
        const item = this.generate(Date.now(), true);
        this.items.push(item);
        if (this.items.length > 500) this.items.splice(0, this.items.length - 500);
        onItem?.(item);
        schedule();
      }, this.rng.uniform(6_000, 25_000));
    };
    schedule();
  }

  stop() {
    clearTimeout(this.timer);
  }

  list({ symbol, limit = 100, q } = {}) {
    let items = this.items;
    if (symbol) items = items.filter((i) => i.tickers.includes(symbol));
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((i) => i.headline.toLowerCase().includes(needle));
    }
    return items.slice(-limit).reverse();
  }
}

function engine_quarter() {
  const m = new Date().getUTCMonth();
  return Math.floor(m / 3) + 1;
}
