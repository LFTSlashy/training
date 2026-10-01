import { useState } from 'react';
import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { useMarket } from '../store/market';
import { Loading, DivBar } from '../components/common';
import { fmtCompact, fmtPct, fmtPrice, signClass } from '../lib/format';

interface Row { symbol: string; name: string; last: number; changePct: number; volume: number; turnoverUsd: number }
interface Movers { gainers: Row[]; losers: Row[]; active: Row[] }

const UNIVERSES: Record<string, string> = { Equities: 'equity', ETFs: 'etf', 'All risk': 'equity,etf,crypto,commodity,index' };

export default function MoversPanel({ load }: PanelProps) {
  const [universe, setUniverse] = useState('Equities');
  const { data } = useApi<Movers>(`/market/movers?types=${UNIVERSES[universe]}`, 3000);
  const instruments = useMarket((s) => s.instruments);
  if (!data) return <Loading />;
  const maxAbs = Math.max(...data.gainers.map((r) => Math.abs(r.changePct)), ...data.losers.map((r) => Math.abs(r.changePct)), 0.5);
  const Table = ({ title, rows, mode }: { title: string; rows: Row[]; mode: 'chg' | 'vol' }) => (
    <div style={{ minWidth: 0 }}>
      <div className="section-title">{title}</div>
      <table className="grid"><tbody>
        {rows.slice(0, 10).map((r) => (
          <tr key={r.symbol} className="clickable" onClick={() => load({ symbol: r.symbol })}>
            <td className="sym" title={r.name}>{r.symbol}</td>
            <td className="num mono">{fmtPrice(r.last, instruments[r.symbol])}</td>
            <td className={`num mono ${signClass(r.changePct)}`}>{fmtPct(r.changePct)}</td>
            <td>{mode === 'chg' ? <DivBar value={r.changePct} max={maxAbs} width={60} /> : <span className="mono muted">${fmtCompact(r.turnoverUsd, 1)}</span>}</td>
          </tr>
        ))}
      </tbody></table>
    </div>
  );
  return (
    <div>
      <div className="toolbar">
        {Object.keys(UNIVERSES).map((u) => <span key={u} className={`chip ${u === universe ? 'on' : ''}`} onClick={() => setUniverse(u)}>{u}</span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        <Table title="▲ Top gainers" rows={data.gainers} mode="chg" />
        <Table title="▼ Top losers" rows={data.losers} mode="chg" />
        <Table title="◆ Most active ($ turnover)" rows={data.active} mode="vol" />
      </div>
    </div>
  );
}
