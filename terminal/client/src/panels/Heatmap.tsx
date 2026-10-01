import { useEffect, useRef, useState } from 'react';
import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { Loading, heatColor } from '../components/common';
import { fmtPct } from '../lib/format';

interface Item { symbol: string; name: string; changePct: number; capUsdBn: number }
interface Sector { sector: string; capUsdBn: number; changePct: number; items: Item[] }
interface Rect { x: number; y: number; w: number; h: number }

/** Squarified treemap layout. */
function squarify<T extends { value: number }>(items: T[], rect: Rect): (T & Rect)[] {
  const out: (T & Rect)[] = [];
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!total || !items.length) return out;
  const scale = (rect.w * rect.h) / total;
  const nodes = items.map((i) => ({ ...i, area: i.value * scale }));
  let r = { ...rect };
  let row: typeof nodes = [];
  const worst = (row: typeof nodes, side: number) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    const max = Math.max(...row.map((x) => x.area)), min = Math.min(...row.map((x) => x.area));
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const layoutRow = (row: typeof nodes) => {
    const s = row.reduce((a, b) => a + b.area, 0);
    if (r.w >= r.h) {
      const w = s / r.h;
      let y = r.y;
      for (const n of row) { const h = n.area / w; out.push({ ...n, x: r.x, y, w, h }); y += h; }
      r = { x: r.x + w, y: r.y, w: r.w - w, h: r.h };
    } else {
      const h = s / r.w;
      let x = r.x;
      for (const n of row) { const w = n.area / h; out.push({ ...n, x, y: r.y, w, h }); x += w; }
      r = { x: r.x, y: r.y + h, w: r.w, h: r.h - h };
    }
  };
  for (const n of nodes) {
    const side = Math.min(r.w, r.h);
    if (!row.length || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layoutRow(row); row = [n]; }
  }
  if (row.length) layoutRow(row);
  return out;
}

export default function Heatmap({ load }: PanelProps) {
  const { data } = useApi<Sector[]>('/market/heatmap', 2000);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const sectors = data ? squarify(data.map((s) => ({ ...s, value: s.capUsdBn })), { x: 0, y: 0, w: size.w, h: size.h }) : [];
  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      {!data && <Loading />}
      {sectors.map((s) => {
        const inner = squarify(s.items.map((i) => ({ ...i, value: i.capUsdBn })), { x: s.x + 1, y: s.y + 15, w: Math.max(0, s.w - 2), h: Math.max(0, s.h - 16) });
        return (
          <div key={s.sector} style={{ position: 'absolute', left: s.x, top: s.y, width: s.w, height: s.h, border: '1px solid var(--bg)', background: 'var(--bg-2)' }}>
            <div style={{ height: 14, fontSize: 9.5, padding: '1px 4px', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.06em', whiteSpace: 'nowrap', overflow: 'hidden', display: 'flex', justifyContent: 'space-between' }}>
              <span>{s.sector}</span><span className="mono">{fmtPct(s.changePct)}</span>
            </div>
            {inner.map((i) => (
              <div key={i.symbol} onClick={() => load({ symbol: i.symbol })} title={`${i.name}\n${fmtPct(i.changePct)} · $${i.capUsdBn.toFixed(0)}bn`}
                style={{ position: 'absolute', left: i.x - s.x, top: i.y - s.y, width: i.w, height: i.h, background: heatColor(i.changePct), border: '1px solid rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', cursor: 'pointer', fontFamily: 'var(--mono)', color: '#fff' }}>
                {i.w > 34 && i.h > 18 && <span style={{ fontWeight: 700, fontSize: Math.min(15, Math.max(9, Math.sqrt(i.w * i.h) / 6)) }}>{i.symbol}</span>}
                {i.w > 40 && i.h > 32 && <span style={{ fontSize: 10, opacity: 0.9 }}>{fmtPct(i.changePct)}</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
