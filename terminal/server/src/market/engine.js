import { EventEmitter } from 'node:events';
import { buildUniverse, FACTOR_VOLS } from './instruments.js';
import { Rng, noise } from '../lib/rng.js';

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const YEAR_MIN = 365 * 1440;
const MAX_MINUTE_BARS = 3 * 1440;
const TAPE_SIZE = 120;
const FACTORS = Object.keys(FACTOR_VOLS);
const DRIFT = { equity: 0.02, etf: 0, index: 0, crypto: 0, commodity: 0, fx: 0, rate: 0 };
// Annual drift carried by factors (keeps indices trending up over the history like real markets).
const FACTOR_DRIFT = { EQ: 0.11, TECH: 0.06, CRYPTO: 0.35, METAL: 0.12 };

export const dayStart = (ms) => Math.floor(ms / DAY_MS) * DAY_MS;
export const minuteStart = (ms) => Math.floor(ms / MIN_MS) * MIN_MS;

function roundTo(value, tick) {
  const r = Math.round(value / tick) * tick;
  // Clean binary noise (e.g. 1.11350000001)
  return Number(r.toFixed(Math.max(0, Math.ceil(-Math.log10(tick)) + 1)));
}

/**
 * Multi-factor market simulator.
 * Every instrument's return = Σ exposure·factor shock + idiosyncratic shock (+ news jumps),
 * which yields realistic cross-asset correlation (tech names co-move, USD factor drives FX, etc.).
 */
export class MarketEngine extends EventEmitter {
  constructor({ seed = 1, tickMs = 500, simSpeed = 4, historyDays = 750, now = Date.now() } = {}) {
    super();
    this.setMaxListeners(100);
    this.seed = seed;
    this.tickMs = tickMs;
    this.simSpeed = simSpeed;
    this.historyDays = historyDays;
    this.universe = buildUniverse();
    this.state = new Map();
    this.pendingShocks = new Map();
    this.pendingFactorShocks = new Map();
    this.liveRng = new Rng(seed ^ (now & 0xffffffff));
    this.timer = null;
    this.tickCount = 0;
    this.generate(now);
  }

  // ── Setup ────────────────────────────────────────────────────────────
  idioVol(inst) {
    let sys = 0;
    for (const { f, b } of inst.factors) sys += (b * FACTOR_VOLS[f]) ** 2;
    return Math.sqrt(Math.max(inst.vol ** 2 - sys, (0.3 * inst.vol) ** 2));
  }

  generate(now) {
    const today = dayStart(now);
    const intradayStart = today - DAY_MS; // yesterday 00:00 UTC
    const nDays = this.historyDays;
    const firstDay = intradayStart - nDays * DAY_MS;

    // Shared daily factor shocks
    const fr = new Rng(this.seed);
    const dailyFactors = Array.from({ length: nDays }, () => {
      const row = {};
      // volatility clustering via a slowly varying regime multiplier
      for (const f of FACTORS) row[f] = fr.normal();
      return row;
    });
    let regime = 1;
    const regimes = dailyFactors.map(() => {
      regime = Math.min(2.6, Math.max(0.6, regime * Math.exp(0.12 * fr.normal()) * (1 + 0.04 * (1 - regime))));
      return regime;
    });

    const minutes = Math.floor((minuteStart(now) - intradayStart) / MIN_MS) + 1;
    const ir = new Rng(this.seed + 7);
    const minuteFactors = Array.from({ length: minutes }, () => {
      const row = {};
      for (const f of FACTORS) row[f] = ir.normal();
      return row;
    });

    for (const inst of this.universe.values()) {
      const rng = new Rng(`${this.seed}:${inst.symbol}`);
      const idio = this.idioVol(inst);
      const sdDay = Math.sqrt(1 / 365);
      const drift = (DRIFT[inst.type] ?? 0) / 365;
      const abs = inst.process === 'abs';

      // 1) Daily path (in log space, or absolute for yields)
      const path = [0];
      let x = 0;
      for (let d = 0; d < nDays; d++) {
        const reg = regimes[d];
        let shock = 0;
        let mu = 0;
        for (const { f, b } of inst.factors) {
          shock += b * FACTOR_VOLS[f] * dailyFactors[d][f];
          mu += b * (FACTOR_DRIFT[f] || 0);
        }
        shock = (shock + idio * rng.fatNormal(4)) * sdDay * reg + (abs ? 0 : mu / 365);
        if (inst.process === 'ou') shock += (inst.kappa / 365) * (Math.log(inst.mean) - Math.log(inst.price) - x);
        else if (!abs) shock += drift;
        x += shock;
        path.push(x);
      }
      const end = path[path.length - 1];
      const level = (v) => (abs ? inst.price + (v - end) : inst.price * Math.exp(v - end));
      const daily = [];
      const adv = inst.adv || 0;
      for (let d = 0; d < nDays; d++) {
        const o0 = level(path[d]);
        const c = level(path[d + 1]);
        const gap = (abs ? 0.02 : o0 * 0.002) * rng.normal() * (inst.type === 'crypto' ? 0 : 1);
        const o = o0 + gap;
        const range = abs ? inst.vol * sdDay * 0.6 : Math.max(o, c) * inst.vol * sdDay * 0.6;
        const h = Math.max(o, c) + Math.abs(rng.normal()) * range;
        const l = Math.max(Math.min(o, c) - Math.abs(rng.normal()) * range, abs ? -5 : Math.min(o, c) * 0.5);
        const move = abs ? Math.abs(c - o0) / (inst.vol * sdDay) : Math.abs(Math.log(c / o0)) / (inst.vol * sdDay);
        const v = adv ? Math.round(adv * Math.exp(0.3 * rng.normal()) * (0.7 + 0.35 * move)) : 0;
        daily.push({ t: (firstDay + d * DAY_MS) / 1000, o: roundTo(o, inst.tick), h: roundTo(h, inst.tick), l: roundTo(l, inst.tick), c: roundTo(c, inst.tick), v });
      }

      const st = {
        inst,
        idio,
        mid: daily[daily.length - 1].c,
        last: daily[daily.length - 1].c,
        bid: 0, ask: 0,
        prevClose: daily[daily.length - 1].c,
        open: 0, high: 0, low: 0,
        volume: 0, turnover: 0,
        daily, minute: [], tape: [],
        updated: now,
        dayT: 0,
        lastDir: 0,
      };
      this.state.set(inst.symbol, st);

      // 2) Intraday 1-minute path from yesterday 00:00 UTC to now
      const dtMin = this.simSpeed / YEAR_MIN;
      const sq = Math.sqrt(dtMin);
      const advMin = adv / 1440;
      for (let m = 0; m < minutes; m++) {
        const t = intradayStart + m * MIN_MS;
        if (dayStart(t) !== st.dayT) this.rollDay(st, t);
        let shock = 0;
        for (const { f, b } of inst.factors) shock += b * FACTOR_VOLS[f] * minuteFactors[m][f];
        shock = (shock + idio * rng.normal()) * sq;
        const o = st.mid;
        let hi = o, lo = o, mid = o;
        // four sub-steps per minute so bars have realistic wicks
        for (let k = 0; k < 4; k++) {
          const s = shock / 4 + idio * sq * 0.5 * rng.normal() / 2;
          mid = this.applyReturn(st, mid, s, dtMin / 4);
          hi = Math.max(hi, mid);
          lo = Math.min(lo, mid);
        }
        st.mid = mid;
        const v = advMin ? Math.round(advMin * Math.exp(0.6 * rng.normal()) * (0.6 + 0.8 * Math.abs(shock) / (inst.vol * sq + 1e-12))) : 0;
        const bar = { t: t / 1000, o: roundTo(o, inst.tick), h: roundTo(hi, inst.tick), l: roundTo(lo, inst.tick), c: roundTo(mid, inst.tick), v };
        st.minute.push(bar);
        this.updateDayFromBar(st, bar);
      }
      st.last = roundTo(st.mid, inst.tick);
      this.updateSpread(st);
    }
  }

  applyReturn(st, mid, shock, dt) {
    const inst = st.inst;
    if (inst.process === 'abs') return mid + shock;
    if (inst.process === 'ou') {
      const pull = inst.kappa * (Math.log(inst.mean) - Math.log(mid)) * dt;
      return mid * Math.exp(shock + pull);
    }
    return mid * Math.exp(shock);
  }

  rollDay(st, t) {
    const ds = dayStart(t);
    if (st.dayT && st.daily.length) {
      st.prevClose = st.last || st.mid;
    }
    st.dayT = ds;
    const p = roundTo(st.mid, st.inst.tick);
    st.open = p; st.high = p; st.low = p;
    st.volume = 0; st.turnover = 0;
    st.prevClose = st.daily.length ? st.daily[st.daily.length - 1].c : p;
    st.daily.push({ t: ds / 1000, o: p, h: p, l: p, c: p, v: 0 });
  }

  updateDayFromBar(st, bar) {
    const d = st.daily[st.daily.length - 1];
    d.h = Math.max(d.h, bar.h);
    d.l = Math.min(d.l, bar.l);
    d.c = bar.c;
    d.v += bar.v;
    st.high = d.h; st.low = d.l; st.volume = d.v;
    st.turnover += bar.v * (bar.h + bar.l + bar.c) / 3;
    st.last = bar.c;
  }

  updateSpread(st) {
    const { inst } = st;
    if (inst.type === 'rate') {
      st.bid = st.ask = st.last;
      return;
    }
    const half = Math.max(inst.tick / 2, (st.mid * inst.spreadBps) / 2e4);
    let bid = Math.floor((st.mid - half) / inst.tick) * inst.tick;
    let ask = Math.ceil((st.mid + half) / inst.tick) * inst.tick;
    if (ask - bid < inst.tick * 0.999) ask = bid + inst.tick;
    st.bid = roundTo(bid, inst.tick);
    st.ask = roundTo(ask, inst.tick);
  }

  // ── Live loop ─────────────────────────────────────────────────────────
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        this.tick(Date.now());
      } catch (err) {
        console.error('[engine] tick failed', err);
      }
    }, this.tickMs);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  /** Inject an idiosyncratic jump (e.g. news) — pct as a fraction, e.g. 0.02 = +2%. */
  shock(symbol, pct) {
    if (!this.state.has(symbol)) return;
    this.pendingShocks.set(symbol, (this.pendingShocks.get(symbol) || 0) + pct);
  }

  /** Inject a factor-wide move in standard deviations of a daily move (macro news). */
  factorShock(factor, sigmas) {
    this.pendingFactorShocks.set(factor, (this.pendingFactorShocks.get(factor) || 0) + sigmas);
  }

  tick(now) {
    this.tickCount++;
    const rng = this.liveRng;
    const dt = (this.simSpeed * this.tickMs / MIN_MS) / YEAR_MIN;
    const sq = Math.sqrt(dt);
    const fz = {};
    for (const f of FACTORS) fz[f] = rng.normal();
    const factorJump = {};
    for (const [f, s] of this.pendingFactorShocks) factorJump[f] = s * FACTOR_VOLS[f] * Math.sqrt(1 / 365);
    this.pendingFactorShocks.clear();

    const changed = [];
    const minuteT = minuteStart(now) / 1000;
    for (const st of this.state.values()) {
      const { inst } = st;
      if (dayStart(now) !== st.dayT) {
        this.rollDay(st, now);
        this.emit('dayroll', inst.symbol);
      }
      let shock = 0;
      let jump = 0;
      for (const { f, b } of inst.factors) {
        shock += b * FACTOR_VOLS[f] * fz[f];
        if (factorJump[f]) jump += b * factorJump[f];
      }
      shock = (shock + st.idio * rng.normal()) * sq + jump;
      const pend = this.pendingShocks.get(inst.symbol);
      if (pend) {
        shock += inst.process === 'abs' ? pend : Math.log(1 + pend);
        this.pendingShocks.delete(inst.symbol);
      }
      const prevLast = st.last;
      st.mid = this.applyReturn(st, st.mid, shock, dt);
      if (inst.process !== 'abs' && st.mid <= inst.tick) st.mid = inst.tick * 2;
      st.last = roundTo(st.mid, inst.tick);
      this.updateSpread(st);

      // Volume & tape
      const advTick = (inst.adv || 0) / (1440 * MIN_MS / this.tickMs);
      const activity = 0.5 + Math.abs(shock) / (inst.vol * sq + 1e-12);
      const vol = advTick ? Math.max(0, Math.round(advTick * activity * Math.exp(0.8 * rng.normal()) / inst.lot) * inst.lot) : 0;
      if (st.last !== prevLast) st.lastDir = st.last > prevLast ? 1 : -1;

      let bar = st.minute[st.minute.length - 1];
      if (!bar || bar.t !== minuteT) {
        bar = { t: minuteT, o: prevLast, h: prevLast, l: prevLast, c: prevLast, v: 0 };
        st.minute.push(bar);
        if (st.minute.length > MAX_MINUTE_BARS) st.minute.splice(0, st.minute.length - MAX_MINUTE_BARS);
      }
      bar.h = Math.max(bar.h, st.last);
      bar.l = Math.min(bar.l, st.last);
      bar.c = st.last;
      bar.v += vol;

      const d = st.daily[st.daily.length - 1];
      d.h = Math.max(d.h, st.last);
      d.l = Math.min(d.l, st.last);
      d.c = st.last;
      d.v += vol;
      st.high = d.h; st.low = d.l; st.volume = d.v;
      st.turnover += vol * st.last;

      if (inst.type !== 'rate' && (vol > 0 || rng.chance(0.25))) {
        const side = st.lastDir >= 0 ? (rng.chance(0.65) ? 'B' : 'S') : (rng.chance(0.65) ? 'S' : 'B');
        const size = vol > 0 ? vol : this.lotSize(inst, rng);
        st.tape.push({ t: now, p: side === 'B' ? st.ask : st.bid, s: size, side });
        if (st.tape.length > TAPE_SIZE) st.tape.shift();
      }
      st.updated = now;
      changed.push(inst.symbol);
    }
    this.emit('tick', changed, now);
  }

  lotSize(inst, rng) {
    if (inst.type === 'fx') return Math.round(Math.exp(rng.uniform(11, 15)) / 1000) * 1000;
    if (inst.type === 'commodity' || inst.type === 'index') return rng.int(1, 25);
    if (inst.type === 'crypto') return Number((Math.exp(rng.uniform(-2, 3)) * (1000 / inst.price)).toFixed(4)) || inst.lot;
    return Math.max(inst.lot, Math.round(Math.exp(rng.uniform(3, 7)) / inst.lot) * inst.lot);
  }

  // ── Queries ───────────────────────────────────────────────────────────
  has(symbol) {
    return this.state.has(symbol);
  }

  instrument(symbol) {
    return this.universe.get(symbol);
  }

  instruments() {
    return [...this.universe.values()];
  }

  quote(symbol) {
    const st = this.state.get(symbol);
    if (!st) return null;
    const { inst } = st;
    const change = st.last - st.prevClose;
    const top = inst.type === 'rate' ? null : this.book(symbol, 1);
    return {
      symbol,
      last: st.last,
      bid: st.bid,
      ask: st.ask,
      bidSize: top ? top.bids[0].size : 0,
      askSize: top ? top.asks[0].size : 0,
      open: st.open,
      high: st.high,
      low: st.low,
      prevClose: st.prevClose,
      change: roundTo(change, inst.tick / 10),
      changePct: inst.process === 'abs' ? change * 100 : (change / st.prevClose) * 100, // bp for yields
      volume: st.volume,
      vwap: st.volume ? st.turnover / st.volume : st.last,
      dir: st.lastDir,
      t: st.updated,
    };
  }

  quotes(symbols) {
    const out = {};
    for (const s of symbols ?? this.state.keys()) {
      const q = this.quote(s);
      if (q) out[s] = q;
    }
    return out;
  }

  /** Spark line of the last `n` minute closes. */
  spark(symbol, n = 60) {
    const st = this.state.get(symbol);
    if (!st) return [];
    return st.minute.slice(-n).map((b) => b.c);
  }

  history(symbol, interval = '1D', limit = 500) {
    const st = this.state.get(symbol);
    if (!st) return null;
    const agg = (bars, sec) => {
      const out = [];
      for (const b of bars) {
        const t = Math.floor(b.t / sec) * sec;
        const cur = out[out.length - 1];
        if (cur && cur.t === t) {
          cur.h = Math.max(cur.h, b.h);
          cur.l = Math.min(cur.l, b.l);
          cur.c = b.c;
          cur.v += b.v;
        } else out.push({ ...b, t });
      }
      return out;
    };
    let bars;
    switch (interval) {
      case '1m': bars = st.minute; break;
      case '5m': bars = agg(st.minute, 300); break;
      case '15m': bars = agg(st.minute, 900); break;
      case '1h': bars = agg(st.minute, 3600); break;
      case '1W': bars = agg(st.daily, 7 * 86400).map((b) => b); break;
      case '1M': {
        const out = [];
        for (const b of st.daily) {
          const d = new Date(b.t * 1000);
          const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
          const cur = out[out.length - 1];
          if (cur && cur.t === t) { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v; }
          else out.push({ ...b, t });
        }
        bars = out;
        break;
      }
      default: bars = st.daily;
    }
    return bars.slice(-limit).map((b) => ({ ...b }));
  }

  dailyCloses(symbol, n = 252) {
    const st = this.state.get(symbol);
    if (!st) return [];
    return st.daily.slice(-n - 1).map((b) => b.c);
  }

  /** Level-2 book synthesised around the touch; sizes evolve every ~1.5 s. */
  book(symbol, depth = 12) {
    const st = this.state.get(symbol);
    if (!st) return null;
    const { inst } = st;
    const step = Math.max(inst.tick, roundTo((st.mid * 0.4) / 1e4, inst.tick));
    const bucket = Math.floor(Date.now() / 1500);
    let base;
    if (inst.type === 'fx') base = 1_000_000;
    else if (inst.type === 'index' || inst.type === 'commodity') base = 40;
    else if (inst.type === 'crypto') base = Math.max(inst.lot, 25_000 / st.mid);
    else base = Math.max(inst.lot * 2, (inst.adv || 1e6) / 4000);
    const size = (side, i, price) => {
      const n = noise(`${symbol}:${side}:${price}:${bucket}`);
      const raw = base * (0.25 + 1.75 * n) * (1 + 0.28 * i) * (n > 0.93 ? 4 : 1);
      const lot = inst.lot || 1;
      return Math.max(lot, Number((Math.round(raw / lot) * lot).toFixed(lot < 1 ? 4 : 0)));
    };
    const bids = [];
    const asks = [];
    for (let i = 0; i < depth; i++) {
      const bp = roundTo(st.bid - i * step, inst.tick);
      const ap = roundTo(st.ask + i * step, inst.tick);
      bids.push({ price: bp, size: size('b', i, bp), orders: 1 + Math.floor(noise(`${symbol}:nb:${bp}:${bucket}`) * 18) });
      asks.push({ price: ap, size: size('a', i, ap), orders: 1 + Math.floor(noise(`${symbol}:na:${ap}:${bucket}`) * 18) });
    }
    return { symbol, bids, asks, mid: st.mid, spread: roundTo(st.ask - st.bid, inst.tick), t: Date.now() };
  }

  tape(symbol, n = 60) {
    const st = this.state.get(symbol);
    if (!st) return [];
    return st.tape.slice(-n).reverse();
  }

  /** USD value of one unit of `ccy`. */
  fxToUsd(ccy) {
    if (!ccy || ccy === 'USD') return 1;
    const direct = this.state.get(`${ccy}USD`);
    if (direct) return direct.mid;
    const inverse = this.state.get(ccy === 'CNY' ? 'USDCNH' : `USD${ccy}`);
    if (inverse) return 1 / inverse.mid;
    return 1;
  }
}
