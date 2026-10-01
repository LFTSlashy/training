import type { Instrument } from './types';

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number = min) {
  const key = `${min}:${max}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
    nfCache.set(key, f);
  }
  return f;
}

export function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return nf(decimals).format(v);
}

export function fmtPrice(v: number | null | undefined, inst?: Pick<Instrument, 'decimals'> | null): string {
  return fmtNum(v, inst?.decimals ?? 2);
}

export function fmtPct(v: number | null | undefined, decimals = 2, sign = true): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${sign && v > 0 ? '+' : ''}${nf(decimals).format(v)}%`;
}

export function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v > 0 ? '+' : ''}${nf(decimals).format(v)}`;
}

export function fmtCompact(v: number | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e12) return `${nf(decimals).format(v / 1e12)}T`;
  if (a >= 1e9) return `${nf(decimals).format(v / 1e9)}B`;
  if (a >= 1e6) return `${nf(decimals).format(v / 1e6)}M`;
  if (a >= 1e4) return `${nf(1).format(v / 1e3)}K`;
  return nf(0, decimals).format(v);
}

export function fmtUsd(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v < 0 ? '-' : ''}$${nf(decimals).format(Math.abs(v))}`;
}

export function fmtQty(v: number, lot = 1): string {
  return lot < 1 ? nf(0, Math.ceil(-Math.log10(lot))).format(v) : nf(0).format(v);
}

export function fmtTime(t: number, seconds = true): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ''}`;
}

export function fmtDate(t: number): string {
  const d = new Date(t);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function fmtDateTime(t: number): string {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return fmtTime(t, false);
  return `${fmtDate(t)} ${fmtTime(t, false)}`;
}

export const signClass = (v: number | null | undefined) => (!v ? 'flat' : v > 0 ? 'up' : 'down');

/** Change display for yields is in basis points. */
export function fmtChange(changePct: number, inst?: Instrument | null): string {
  if (inst?.type === 'rate') return `${changePct > 0 ? '+' : ''}${nf(1).format(changePct)}bp`;
  return fmtPct(changePct);
}
