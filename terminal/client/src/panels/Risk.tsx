import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { fmtNum, fmtPct, fmtUsd, signClass } from '../lib/format';
import { Kpi, Loading, Empty, DivBar } from '../components/common';
import { useState } from 'react';

interface Group { name: string; long: number; short: number; net: number; gross: number; pct: number }
interface RiskData {
  var95: number; var99: number; cvar95: number; volatility: number; volatilityPct: number; beta: number; sharpe: number | null;
  exposures: { assetClass: Group[]; sector: Group[]; currency: Group[]; region: Group[] };
  scenarios: { id: string; name: string; pnl: number; pnlPct: number }[];
  contributions: { symbol: string; pct: number; standaloneVol: number }[];
  histogram: { from: number; to: number; count: number }[];
  worstDay: number | null; bestDay: number | null; days: number;
}

export default function Risk({ load }: PanelProps) {
  const { data } = useApi<RiskData>('/account/risk', 15_000);
  const [dim, setDim] = useState<keyof RiskData['exposures']>('assetClass');
  if (!data) return <Loading />;
  if (!data.contributions.length) return <Empty>Risk analytics appear once you hold positions.<br />VaR, stress tests and exposures are computed by historical simulation on {250} days.</Empty>;
  const maxH = Math.max(...data.histogram.map((h) => h.count));
  const maxScen = Math.max(...data.scenarios.map((s) => Math.abs(s.pnl)));
  const groups = data.exposures[dim];
  const maxG = Math.max(...groups.map((g) => g.gross));
  return (
    <div>
      <div className="kpis">
        <Kpi label="1D VaR 95%" value={<span className="down">{fmtUsd(data.var95)}</span>} sub={<span className="muted">99%: {fmtUsd(data.var99)}</span>} />
        <Kpi label="CVaR 95%" value={<span className="down">{fmtUsd(data.cvar95)}</span>} sub={<span className="muted">Expected shortfall</span>} />
        <Kpi label="Ann. volatility" value={fmtUsd(data.volatility)} sub={<span className="muted">{fmtNum(data.volatilityPct, 1)}% of NAV</span>} />
        <Kpi label="Beta (SPX)" value={fmtNum(data.beta, 2)} sub={<span className="muted">Sharpe {data.sharpe === null ? '—' : fmtNum(data.sharpe, 2)}</span>} />
        <Kpi label="Worst / best day" value={<span className="down">{fmtUsd(data.worstDay)}</span>} sub={<span className="up">{fmtUsd(data.bestDay)}</span>} />
      </div>

      <div className="cols-2">
        <div>
          <div className="section-title">Stress scenarios</div>
          <table className="grid"><tbody>
            {data.scenarios.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><DivBar value={s.pnl} max={maxScen} width={80} /></td>
                <td className={`num mono ${signClass(s.pnl)}`}>{fmtUsd(s.pnl)}</td>
                <td className={`num mono ${signClass(s.pnl)}`}>{fmtPct(s.pnlPct)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <div className="section-title">Daily P&amp;L distribution ({data.days}d)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '0 10px' }}>
            {data.histogram.map((h, i) => (
              <div key={i} title={`${fmtUsd(h.from)} … ${fmtUsd(h.to)}: ${h.count} days`} style={{ flex: 1, height: `${(h.count / maxH) * 100}%`, minHeight: 1, background: h.to <= -data.var95 ? 'var(--down)' : h.from >= 0 ? 'var(--up)' : '#566070', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
            ))}
          </div>
          <div className="mono muted" style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 10px', fontSize: 10 }}>
            <span>{fmtUsd(data.histogram[0]?.from)}</span><span>VaR95 {fmtUsd(-data.var95)}</span><span>{fmtUsd(data.histogram.at(-1)?.to)}</span>
          </div>
        </div>
      </div>

      <div className="cols-2">
        <div>
          <div className="section-title">Exposure
            <span className="seg" style={{ marginLeft: 6 }}>
              {(['assetClass', 'sector', 'currency', 'region'] as const).map((d) => <button key={d} className={dim === d ? 'on' : ''} onClick={() => setDim(d)}>{d === 'assetClass' ? 'Asset' : d[0].toUpperCase() + d.slice(1)}</button>)}
            </span>
          </div>
          <table className="grid"><thead><tr><th>Group</th><th className="num">Long</th><th className="num">Short</th><th className="num">% NAV</th><th /></tr></thead><tbody>
            {groups.map((g) => (
              <tr key={g.name}>
                <td>{g.name}</td>
                <td className="num mono up">{fmtUsd(g.long)}</td>
                <td className="num mono down">{fmtUsd(g.short)}</td>
                <td className="num mono">{fmtNum(g.pct, 1)}%</td>
                <td><div className="bar-track" style={{ width: 60 }}><div className="bar-fill" style={{ width: `${(g.gross / maxG) * 100}%`, background: 'var(--amber)' }} /></div></td>
              </tr>
            ))}
          </tbody></table>
        </div>
        <div>
          <div className="section-title">Risk contribution</div>
          <table className="grid"><thead><tr><th>Security</th><th className="num">% of risk</th><th /><th className="num">Stand-alone vol $</th></tr></thead><tbody>
            {data.contributions.map((c) => (
              <tr key={c.symbol} className="clickable" onClick={() => load({ symbol: c.symbol })}>
                <td className="sym">{c.symbol}</td>
                <td className="num mono">{fmtNum(c.pct, 1)}%</td>
                <td><DivBar value={c.pct} max={100} width={70} /></td>
                <td className="num mono">{fmtUsd(c.standaloneVol)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
