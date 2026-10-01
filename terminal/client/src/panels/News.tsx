import { useEffect, useMemo, useState } from 'react';
import type { PanelProps } from './registry';
import { api } from '../lib/api';
import { useMarket } from '../store/market';
import { fmtDateTime } from '../lib/format';
import type { NewsItem } from '../lib/types';
import { Empty } from '../components/common';

const CATS = ['ALL', 'MACRO', 'EARNINGS', 'ANALYST', 'CENTRAL BANK', 'M&A', 'CRYPTO', 'ENERGY'];

export default function News({ p, load, setParams }: PanelProps) {
  const live = useMarket((s) => s.news);
  const [initial, setInitial] = useState<NewsItem[]>([]);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [q, setQ] = useState('');
  const filterSym = Boolean(p.params?.filter);
  const cat = (p.params?.cat as string) || 'ALL';

  useEffect(() => {
    api.get<NewsItem[]>('/news?limit=300').then(setInitial).catch(() => {});
  }, []);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const all = [...live, ...initial].filter((n) => !seen.has(n.id) && seen.add(n.id));
    return all.filter((n) =>
      (!filterSym || n.tickers.includes(p.symbol)) &&
      (cat === 'ALL' || (cat === 'MACRO' ? n.macro : n.category === cat)) &&
      (!q || n.headline.toLowerCase().includes(q.toLowerCase())));
  }, [live, initial, filterSym, p.symbol, cat, q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <span className={`chip ${filterSym ? 'on' : ''}`} onClick={() => setParams({ filter: !filterSym })}>{filterSym ? `${p.symbol} only` : 'All securities'}</span>
        {CATS.map((c) => <span key={c} className={`chip ${c === cat ? 'on' : ''}`} onClick={() => setParams({ cat: c })}>{c}</span>)}
        <span className="spacer" />
        <input className="input" style={{ width: 140, height: 22 }} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ overflow: 'auto', flex: 1 }}>
          {!items.length && <Empty>No stories.</Empty>}
          {items.slice(0, 250).map((n) => (
            <div key={n.id} onClick={() => setSelected(n)} style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: 8, padding: '5px 8px', borderBottom: '1px solid #14181d', cursor: 'pointer', background: selected?.id === n.id ? '#1a1710' : undefined }}>
              <span className="mono muted" style={{ fontSize: 10.5, paddingTop: 1 }}>{fmtDateTime(n.t)}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ lineHeight: 1.35, color: n.urgent ? 'var(--amber-2)' : 'var(--text)', fontWeight: n.urgent ? 600 : 400 }}>
                  {n.urgent && <span className="pill amber" style={{ marginRight: 6 }}>URGENT</span>}
                  {n.headline}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 2, fontSize: 10.5, alignItems: 'center' }}>
                  <span className="muted">{n.source}</span>
                  <span className={`pill ${n.sentiment > 0 ? 'up' : n.sentiment < 0 ? 'down' : 'gray'}`}>{n.category}</span>
                  {n.tickers.slice(0, 4).map((t) => <span key={t} className="mono amber" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); load({ symbol: t }); }}>{t}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
        {selected && (
          <div style={{ width: '45%', minWidth: 220, borderLeft: '1px solid var(--line)', overflow: 'auto', padding: 12, position: 'relative' }}>
            <button className="icon-btn" style={{ position: 'absolute', right: 6, top: 6 }} onClick={() => setSelected(null)}>×</button>
            <div className="mono muted" style={{ fontSize: 10.5 }}>{new Date(selected.t).toLocaleString()} · {selected.source}</div>
            <h3 style={{ margin: '8px 20px 10px 0', fontSize: 15, lineHeight: 1.35 }}>{selected.headline}</h3>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {selected.tickers.map((t) => <button key={t} className="btn sm" onClick={() => load({ symbol: t })}>{t}</button>)}
            </div>
            {selected.body.split('\n\n').map((para, i) => <p key={i} style={{ lineHeight: 1.6, color: 'var(--text-2)', margin: '0 0 10px' }}>{para}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}
