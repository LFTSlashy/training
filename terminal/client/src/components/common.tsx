import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { fmtChange, fmtPrice, signClass } from '../lib/format';
import type { Instrument } from '../lib/types';
import type { SortDir } from '../lib/hooks';

/** Price cell that flashes green/red on upticks/downticks. */
export const FlashPrice = memo(function FlashPrice({ value, inst, className = '' }: { value: number | undefined; inst?: Instrument | null; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState('');
  useEffect(() => {
    if (value !== undefined && prev.current !== undefined && value !== prev.current) {
      setFlash(value > prev.current ? 'flash-up' : 'flash-down');
      const t = setTimeout(() => setFlash(''), 800);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value]);
  return <span className={`mono ${flash} ${className}`} style={{ borderRadius: 2, padding: '0 2px' }}>{fmtPrice(value, inst)}</span>;
});

export function Change({ pct, inst, pill = false }: { pct: number | undefined; inst?: Instrument | null; pill?: boolean }) {
  if (pct === undefined) return <span className="muted">—</span>;
  return <span className={`mono ${signClass(pct)} ${pill ? `pill ${signClass(pct)}` : ''}`}>{fmtChange(pct, inst)}</span>;
}

export const Sparkline = memo(function Sparkline({ data, width = 80, height = 20, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (!data || data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * width).toFixed(1)},${(height - 2 - ((v - min) / range) * (height - 4)).toFixed(1)}`);
  const up = data[data.length - 1] >= data[0];
  const c = color || (up ? 'var(--up)' : 'var(--down)');
  const id = `g${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.25" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts.join(' ')} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={c} strokeWidth="1.2" />
    </svg>
  );
});

export function Th<T>({ k, label, sort, num = false, title }: { k: keyof T; label: ReactNode; sort: { key: keyof T | null; dir: SortDir; toggle: (k: keyof T) => void }; num?: boolean; title?: string }) {
  const on = sort.key === k;
  return (
    <th className={`sortable ${num ? 'num' : ''}`} onClick={() => sort.toggle(k)} title={title}>
      {label}{on ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );
}

export function Kpi({ label, value, sub, cls }: { label: string; value: ReactNode; sub?: ReactNode; cls?: string }) {
  return (
    <div className="kpi">
      <div className="l">{label}</div>
      <div className={`v ${cls || ''}`}>{value}</div>
      {sub !== undefined && <div className="s">{sub}</div>}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: (T | [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>;
      })}
    </div>
  );
}

export const Loading = () => <div className="loading" />;
export const Empty = ({ children }: { children: ReactNode }) => <div className="empty">{children}</div>;

/** Horizontal bar used for diverging values (e.g. % change, exposure). */
export function DivBar({ value, max, width = 90 }: { value: number; max: number; width?: number }) {
  const w = Math.min(1, Math.abs(value) / (max || 1)) * (width / 2);
  return (
    <div style={{ width, height: 8, position: 'relative', background: 'var(--bg-3)', borderRadius: 2 }}>
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line-2)' }} />
      <div style={{ position: 'absolute', top: 1, bottom: 1, borderRadius: 2, background: value >= 0 ? 'var(--up)' : 'var(--down)', left: value >= 0 ? '50%' : `calc(50% - ${w}px)`, width: w }} />
    </div>
  );
}

/** Color for heatmap cells based on % change. */
export function heatColor(pct: number, scale = 3) {
  const x = Math.max(-1, Math.min(1, pct / scale));
  if (x >= 0) return `rgba(25, 195, 125, ${0.12 + x * 0.68})`;
  return `rgba(240, 77, 85, ${0.12 + -x * 0.68})`;
}
