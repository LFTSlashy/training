import type { Bar } from './types';

export interface Point { time: number; value: number }

export function sma(bars: Bar[], n: number): Point[] {
  const out: Point[] = [];
  let sum = 0;
  for (let i = 0; i < bars.length; i++) {
    sum += bars[i].c;
    if (i >= n) sum -= bars[i - n].c;
    if (i >= n - 1) out.push({ time: bars[i].t, value: sum / n });
  }
  return out;
}

export function ema(bars: Bar[], n: number): Point[] {
  const out: Point[] = [];
  const k = 2 / (n + 1);
  let prev: number | null = null;
  for (let i = 0; i < bars.length; i++) {
    prev = prev === null ? bars[i].c : bars[i].c * k + prev * (1 - k);
    if (i >= n - 1) out.push({ time: bars[i].t, value: prev });
  }
  return out;
}

export function bollinger(bars: Bar[], n = 20, mult = 2) {
  const upper: Point[] = [], lower: Point[] = [], mid: Point[] = [];
  for (let i = n - 1; i < bars.length; i++) {
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += bars[j].c;
    const m = s / n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (bars[j].c - m) ** 2;
    const sd = Math.sqrt(v / n);
    mid.push({ time: bars[i].t, value: m });
    upper.push({ time: bars[i].t, value: m + mult * sd });
    lower.push({ time: bars[i].t, value: m - mult * sd });
  }
  return { upper, mid, lower };
}

export function vwap(bars: Bar[]): Point[] {
  const out: Point[] = [];
  let pv = 0, vol = 0, day = -1;
  for (const b of bars) {
    const d = Math.floor(b.t / 86400);
    if (d !== day) { pv = 0; vol = 0; day = d; }
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * (b.v || 1);
    vol += b.v || 1;
    out.push({ time: b.t, value: pv / vol });
  }
  return out;
}

export function rsi(bars: Bar[], n = 14): Point[] {
  const out: Point[] = [];
  let gain = 0, loss = 0;
  for (let i = 1; i < bars.length; i++) {
    const ch = bars[i].c - bars[i - 1].c;
    const g = Math.max(ch, 0), l = Math.max(-ch, 0);
    if (i <= n) {
      gain += g / n;
      loss += l / n;
      if (i === n) out.push({ time: bars[i].t, value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss) });
    } else {
      gain = (gain * (n - 1) + g) / n;
      loss = (loss * (n - 1) + l) / n;
      out.push({ time: bars[i].t, value: loss === 0 ? 100 : 100 - 100 / (1 + gain / loss) });
    }
  }
  return out;
}

export function macd(bars: Bar[], fast = 12, slow = 26, signal = 9) {
  const ef = ema(bars, fast), es = ema(bars, slow);
  const fmap = new Map(ef.map((p) => [p.time, p.value]));
  const line: Point[] = es.map((p) => ({ time: p.time, value: (fmap.get(p.time) ?? p.value) - p.value }));
  const sig: Point[] = [];
  const k = 2 / (signal + 1);
  let prev: number | null = null;
  line.forEach((p, i) => {
    prev = prev === null ? p.value : p.value * k + prev * (1 - k);
    if (i >= signal - 1) sig.push({ time: p.time, value: prev });
  });
  const smap = new Map(sig.map((p) => [p.time, p.value]));
  const hist = line.filter((p) => smap.has(p.time)).map((p) => ({ time: p.time, value: p.value - (smap.get(p.time) as number) }));
  return { line, signal: sig, hist };
}

export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const c = (b.o + b.h + b.l + b.c) / 4;
    const o = i === 0 ? (b.o + b.c) / 2 : (out[i - 1].o + out[i - 1].c) / 2;
    out.push({ t: b.t, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), v: b.v });
  }
  return out;
}

export function atr(bars: Bar[], n = 14): Point[] {
  const out: Point[] = [];
  let prev: number | null = null;
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - bars[i - 1].c), Math.abs(bars[i].l - bars[i - 1].c));
    prev = prev === null ? tr : (prev * (n - 1) + tr) / n;
    if (i >= n) out.push({ time: bars[i].t, value: prev });
  }
  return out;
}
