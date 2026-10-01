import { useEffect, useState } from 'react';
import type { PanelProps } from './registry';
import { api } from '../lib/api';
import { useSort } from '../lib/hooks';
import { useMarket } from '../store/market';
import { Th, Loading, Empty } from '../components/common';
import { fmtNum, fmtPct, fmtPrice, signClass } from '../lib/format';

interface Row {
  symbol: string; name: string; type: string; sector: string | null; region: string; last: number; changePct: number;
  mktCapUsdBn: number | null; pe: number | null; divYield: number | null; perf1M: number | null; perfYtd: number | null; perf1Y: number | null;
  vol1Y: number; beta: number | null; pctFrom52wHigh: number; unit: string;
}
interface Filters { types: string[]; sectors: string[]; regions: string[]; minMktCap?: string; maxPe?: string; minDivYield?: string; minPerfYtd?: string; maxVol?: string; maxBeta?: string }

const TYPES = ['equity', 'etf', 'index', 'crypto', 'commodity', 'fx'];
const SECTORS = ['Technology', 'Financials', 'Health Care', 'Energy', 'Consumer Discretionary', 'Consumer Staples', 'Communication Services', 'Industrials'];
const REGIONS = ['Americas', 'EMEA', 'Asia/Pacific'];
const PRESETS: Record<string, Partial<Filters>> = {
  'Mega caps': { types: ['equity'], minMktCap: '500' },
  'Value': { types: ['equity'], maxPe: '18' },
  'Dividend': { types: ['equity'], minDivYield: '2.5' },
  'Momentum': { types: ['equity', 'etf', 'crypto'], minPerfYtd: '20' },
  'Low vol': { types: ['equity', 'etf'], maxVol: '20' },
  'Defensive': { types: ['equity'], maxBeta: '0.8' },
};

export default function Screener({ load }: PanelProps) {
  const [f, setF] = useState<Filters>({ types: ['equity'], sectors: [], regions: [] });
  const [rows, setRows] = useState<Row[] | null>(null);
  const instruments = useMarket((s) => s.instruments);
  const sort = useSort<Row>(rows || [], 'mktCapUsdBn');

  useEffect(() => {
    const t = setTimeout(() => api.post<Row[]>('/screener', { ...f, limit: 200 }).then(setRows).catch(() => setRows([])), 200);
    return () => clearTimeout(t);
  }, [f]);

  const toggle = (key: 'types' | 'sectors' | 'regions', v: string) => setF({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] });
  const num = (key: keyof Filters, label: string, ph: string) => (
    <div className="field" style={{ width: 92 }}>
      <label>{label}</label>
      <input className="input" style={{ height: 24 }} placeholder={ph} value={(f[key] as string) || ''} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar" style={{ gap: 6 }}>
        <span className="muted" style={{ fontSize: 10 }}>PRESETS</span>
        {Object.entries(PRESETS).map(([k, v]) => <span key={k} className="chip" onClick={() => setF({ types: [], sectors: [], regions: [], ...v })}>{k}</span>)}
        <span className="chip" onClick={() => setF({ types: ['equity'], sectors: [], regions: [] })}>Reset</span>
      </div>
      <div className="toolbar">
        {TYPES.map((t) => <span key={t} className={`chip ${f.types.includes(t) ? 'on' : ''}`} onClick={() => toggle('types', t)}>{t}</span>)}
        <span style={{ width: 8 }} />
        {REGIONS.map((t) => <span key={t} className={`chip ${f.regions.includes(t) ? 'on' : ''}`} onClick={() => toggle('regions', t)}>{t}</span>)}
      </div>
      <div className="toolbar">
        {SECTORS.map((t) => <span key={t} className={`chip ${f.sectors.includes(t) ? 'on' : ''}`} onClick={() => toggle('sectors', t)}>{t}</span>)}
      </div>
      <div className="toolbar" style={{ alignItems: 'flex-end' }}>
        {num('minMktCap', 'Mkt cap ≥ $bn', '50')}
        {num('maxPe', 'P/E ≤', '25')}
        {num('minDivYield', 'Div yld ≥ %', '2')}
        {num('minPerfYtd', 'YTD ≥ %', '10')}
        {num('maxVol', 'Vol 1Y ≤ %', '30')}
        {num('maxBeta', 'Beta ≤', '1.2')}
        <span className="spacer" />
        <span className="mono muted">{rows ? `${rows.length} matches` : ''}</span>
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {!rows ? <Loading /> : !rows.length ? <Empty>No securities match these filters.</Empty> : (
          <table className="grid">
            <thead><tr>
              <Th k="symbol" label="Security" sort={sort} />
              <Th k="name" label="Name" sort={sort} />
              <Th k="sector" label="Sector" sort={sort} />
              <Th k="last" label="Last" sort={sort} num />
              <Th k="changePct" label="1D" sort={sort} num />
              <Th k="perf1M" label="1M" sort={sort} num />
              <Th k="perfYtd" label="YTD" sort={sort} num />
              <Th k="perf1Y" label="1Y" sort={sort} num />
              <Th k="mktCapUsdBn" label="Mkt cap $bn" sort={sort} num />
              <Th k="pe" label="P/E" sort={sort} num />
              <Th k="divYield" label="Yld %" sort={sort} num />
              <Th k="vol1Y" label="Vol 1Y" sort={sort} num />
              <Th k="beta" label="Beta" sort={sort} num />
              <Th k="pctFrom52wHigh" label="vs 52wH" sort={sort} num />
            </tr></thead>
            <tbody>
              {sort.sorted.map((r) => (
                <tr key={r.symbol} className="clickable" onClick={() => load({ symbol: r.symbol })}>
                  <td className="sym">{r.symbol}</td>
                  <td className="name">{r.name}</td>
                  <td className="dim">{r.sector || r.type}</td>
                  <td className="num mono">{fmtPrice(r.last, instruments[r.symbol])}</td>
                  {[r.changePct, r.perf1M, r.perfYtd, r.perf1Y].map((v, i) => <td key={i} className={`num mono ${signClass(v)}`}>{fmtPct(v, 1)}</td>)}
                  <td className="num mono">{r.mktCapUsdBn ? fmtNum(r.mktCapUsdBn, 0) : '—'}</td>
                  <td className="num mono">{fmtNum(r.pe, 1)}</td>
                  <td className="num mono">{r.divYield ? fmtNum(r.divYield, 2) : '—'}</td>
                  <td className="num mono">{fmtNum(r.vol1Y, 1)}</td>
                  <td className="num mono">{fmtNum(r.beta, 2)}</td>
                  <td className={`num mono ${signClass(r.pctFrom52wHigh)}`}>{fmtPct(r.pctFrom52wHigh, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
