import { useEffect, useRef, useState } from 'react';
import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { Loading, Kpi } from '../components/common';
import { fmtNum, signClass } from '../lib/format';

interface Pt { tenor: string; years: number; yield: number }
interface Curves { US: { current: Pt[]; previous: Pt[] }; DE: { current: Pt[] }; GB: { current: Pt[] }; JP: { current: Pt[] }; spreads: Record<string, number>; policyRate: number }

const SERIES = [
  { key: 'US', label: 'US Treasuries', color: '#ff9f1a' },
  { key: 'US_PREV', label: 'US prev close', color: '#6b6250', dash: true },
  { key: 'DE', label: 'German Bunds', color: '#3d8bfd' },
  { key: 'GB', label: 'UK Gilts', color: '#a774ff' },
  { key: 'JP', label: 'JGBs', color: '#2ec5d3' },
];

function CurveChart({ data, visible }: { data: Curves; visible: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 260 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const lines: Record<string, Pt[]> = { US: data.US.current, US_PREV: data.US.previous, DE: data.DE.current, GB: data.GB.current, JP: data.JP.current };
  const all = Object.entries(lines).filter(([k]) => visible.has(k)).flatMap(([, v]) => v.map((p) => p.yield));
  const min = Math.floor((Math.min(...all) - 0.2) * 4) / 4, max = Math.ceil((Math.max(...all) + 0.2) * 4) / 4;
  const pad = { l: 40, r: 16, t: 12, b: 24 };
  const W = size.w, H = size.h;
  const xs = data.US.current.map((_, i) => i);
  const x = (i: number) => pad.l + (i / (xs.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += (max - min) / 5) ticks.push(v);
  return (
    <div ref={ref} style={{ height: '100%', minHeight: 180 }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.05)" />
            <text x={pad.l - 6} y={y(t) + 3} fill="#687280" fontSize="10" textAnchor="end" fontFamily="JetBrains Mono">{t.toFixed(2)}</text>
          </g>
        ))}
        {data.US.current.map((p, i) => <text key={p.tenor} x={x(i)} y={H - 6} fill="#687280" fontSize="10" textAnchor="middle" fontFamily="JetBrains Mono">{p.tenor}</text>)}
        {SERIES.filter((s) => visible.has(s.key)).map((s) => {
          const pts = lines[s.key];
          return (
            <g key={s.key}>
              <polyline points={pts.map((p, i) => `${x(i)},${y(p.yield)}`).join(' ')} fill="none" stroke={s.color} strokeWidth={s.dash ? 1.2 : 2} strokeDasharray={s.dash ? '4 3' : undefined} />
              {!s.dash && pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.yield)} r={2.5} fill={s.color}><title>{`${s.label} ${p.tenor}: ${p.yield.toFixed(3)}%`}</title></circle>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function CurvesPanel(_: PanelProps) {
  const { data } = useApi<Curves>('/curves', 3000);
  const [visible, setVisible] = useState(new Set(['US', 'US_PREV', 'DE', 'GB']));
  if (!data) return <Loading />;
  const toggle = (k: string) => { const n = new Set(visible); n.has(k) ? n.delete(k) : n.add(k); setVisible(n); };
  const us = data.US.current, prev = data.US.previous;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <Kpi label="Fed funds (mid)" value={`${fmtNum(data.policyRate, 3)}%`} />
        {Object.entries(data.spreads).map(([k, v]) => <Kpi key={k} label={`US ${k}`} value={<span className={signClass(v)}>{fmtNum(v, 1)}bp</span>} />)}
      </div>
      <div className="toolbar">
        {SERIES.map((s) => <span key={s.key} className={`chip ${visible.has(s.key) ? 'on' : ''}`} style={visible.has(s.key) ? { borderColor: s.color, color: s.color, background: 'transparent' } : undefined} onClick={() => toggle(s.key)}>{s.label}</span>)}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}><CurveChart data={data} visible={visible} /></div>
      <table className="grid">
        <thead><tr><th>Tenor</th>{us.map((p) => <th key={p.tenor} className="num">{p.tenor}</th>)}</tr></thead>
        <tbody>
          <tr><td className="sym">US</td>{us.map((p) => <td key={p.tenor} className="num mono">{p.yield.toFixed(3)}</td>)}</tr>
          <tr><td className="muted">Δ bp</td>{us.map((p, i) => { const d = (p.yield - prev[i].yield) * 100; return <td key={p.tenor} className={`num mono ${signClass(d)}`}>{d > 0 ? '+' : ''}{d.toFixed(1)}</td>; })}</tr>
          <tr><td className="sym">DE</td>{data.DE.current.map((p) => <td key={p.tenor} className="num mono dim">{p.yield.toFixed(3)}</td>)}</tr>
          <tr><td className="sym">GB</td>{data.GB.current.map((p) => <td key={p.tenor} className="num mono dim">{p.yield.toFixed(3)}</td>)}</tr>
          <tr><td className="sym">JP</td>{data.JP.current.map((p) => <td key={p.tenor} className="num mono dim">{p.yield.toFixed(3)}</td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}
