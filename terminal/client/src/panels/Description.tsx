import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { useMarket } from '../store/market';
import { Loading, Change, DivBar } from '../components/common';
import { fmtCompact, fmtNum, fmtPct, fmtPrice, signClass } from '../lib/format';

interface Stats { high52w: number; low52w: number; volatility30d: number; volatility1y: number; beta: number | null; correlation: number | null; sharpe: number | null; maxDrawdown: number; perf: Record<string, number | null>; unit: string; betas: { symbol: string; beta: number; correlation: number }[] }
interface Fa { description: string; sector?: string; industry?: string; ceo?: string; headquarters?: string; employees?: number; founded?: number; website?: string; marketCap?: number; pe?: number | null; forwardPe?: number | null; eps?: number; dividendYield?: number; priceToBook?: number; evToEbitda?: number; nextEarnings?: string; analyst?: { consensus: string; targetMean: number; buy: number; hold: number; sell: number } }

export default function Description({ p }: PanelProps) {
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const q = useMarket((s) => s.quotes[p.symbol]);
  const { data: stats } = useApi<Stats>(`/stats/${encodeURIComponent(p.symbol)}`);
  const { data: fa } = useApi<Fa>(`/fundamentals/${encodeURIComponent(p.symbol)}`);
  if (!inst || !q) return <Loading />;
  const rangePos = stats ? (q.last - stats.low52w) / (stats.high52w - stats.low52w || 1) : 0.5;
  const isEq = inst.type === 'equity' || inst.type === 'etf';
  const pctU = stats?.unit === 'bp' ? (v: number | null) => (v === null ? '—' : `${v > 0 ? '+' : ''}${fmtNum(v, 1)}bp`) : (v: number | null) => fmtPct(v);
  return (
    <div>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{inst.name}</div>
          <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{inst.symbol} · {inst.exchange} · {inst.assetClass} · {inst.currency}{inst.sector ? ` · ${inst.sector}` : ''}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>{fmtPrice(q.last, inst)}</div>
          <div className="mono"><span className={signClass(q.change)}>{fmtPrice(q.change, inst)}</span> <Change pct={q.changePct} inst={inst} pill /></div>
        </div>
      </div>
      {fa && <p style={{ padding: '8px 12px 0', margin: 0, lineHeight: 1.6, color: 'var(--text-2)' }}>{fa.description}</p>}
      <div className="cols-2">
        <div>
          <div className="section-title">Trading</div>
          <div className="kv-list">
            <div><span>Bid / Ask</span><span>{fmtPrice(q.bid, inst)} / {fmtPrice(q.ask, inst)}</span></div>
            <div><span>Open</span><span>{fmtPrice(q.open, inst)}</span></div>
            <div><span>Day range</span><span>{fmtPrice(q.low, inst)} – {fmtPrice(q.high, inst)}</span></div>
            <div><span>Prev close</span><span>{fmtPrice(q.prevClose, inst)}</span></div>
            <div><span>Volume</span><span>{fmtCompact(q.volume, 2)}</span></div>
            <div><span>VWAP</span><span>{fmtPrice(q.vwap, inst)}</span></div>
            {stats && <div><span>52w range</span><span>{fmtPrice(stats.low52w, inst)} – {fmtPrice(stats.high52w, inst)}</span></div>}
          </div>
          {stats && (
            <div style={{ padding: '8px 10px' }}>
              <div className="bar-track"><div style={{ position: 'absolute', left: `calc(${Math.max(0, Math.min(1, rangePos)) * 100}% - 4px)`, top: -1, width: 8, height: 8, background: 'var(--amber)', borderRadius: 2 }} /></div>
              <div className="mono muted" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 3 }}><span>52w low</span><span>52w high</span></div>
            </div>
          )}
        </div>
        <div>
          <div className="section-title">{isEq ? 'Valuation' : 'Risk'}</div>
          <div className="kv-list">
            {isEq && fa?.marketCap !== undefined && (
              <>
                <div><span>Market cap</span><span>{fmtCompact(fa.marketCap)} {inst.currency}</span></div>
                <div><span>P/E (TTM / Fwd)</span><span>{fmtNum(fa.pe, 1)} / {fmtNum(fa.forwardPe, 1)}</span></div>
                <div><span>EPS (TTM)</span><span>{fmtNum(fa.eps, 2)}</span></div>
                <div><span>Dividend yield</span><span>{fmtNum(fa.dividendYield, 2)}%</span></div>
                <div><span>P/B · EV/EBITDA</span><span>{fmtNum(fa.priceToBook, 1)} · {fmtNum(fa.evToEbitda, 1)}</span></div>
                <div><span>Next earnings</span><span>{fa.nextEarnings}</span></div>
                {fa.analyst && <div><span>Consensus · PT</span><span className={fa.analyst.consensus === 'BUY' ? 'up' : fa.analyst.consensus === 'SELL' ? 'down' : ''}>{fa.analyst.consensus} · {fmtPrice(fa.analyst.targetMean, inst)}</span></div>}
              </>
            )}
            {stats && (
              <>
                <div><span>Volatility 30d / 1y</span><span>{fmtNum(stats.volatility30d, 1)} / {fmtNum(stats.volatility1y, 1)}{stats.unit === 'bp' ? 'bp' : '%'}</span></div>
                {stats.beta !== null && <div><span>Beta vs SPX</span><span>{fmtNum(stats.beta, 2)}</span></div>}
                {stats.sharpe !== null && <div><span>Sharpe (1y)</span><span>{fmtNum(stats.sharpe, 2)}</span></div>}
                <div><span>Max drawdown (1y)</span><span className="down">{stats.unit === 'bp' ? `${fmtNum(stats.maxDrawdown * 100, 0)}bp` : fmtPct(stats.maxDrawdown, 1)}</span></div>
              </>
            )}
          </div>
        </div>
      </div>
      {stats && (
        <div className="cols-2">
          <div>
            <div className="section-title">Performance</div>
            <table className="grid"><tbody>
              {Object.entries(stats.perf).map(([k, v]) => (
                <tr key={k}><td className="mono">{k}</td><td><DivBar value={v ?? 0} max={Math.max(...Object.values(stats.perf).map((x) => Math.abs(x ?? 0)), 1)} width={110} /></td><td className={`num mono ${signClass(v)}`}>{pctU(v)}</td></tr>
              ))}
            </tbody></table>
          </div>
          <div>
            <div className="section-title">Cross-asset sensitivity (1y)</div>
            <table className="grid"><thead><tr><th>Factor</th><th className="num">Beta</th><th className="num">Corr</th><th /></tr></thead><tbody>
              {stats.betas.map((b) => (
                <tr key={b.symbol}><td className="sym">{b.symbol}</td><td className="num mono">{fmtNum(b.beta, 2)}</td><td className={`num mono ${signClass(b.correlation)}`}>{fmtNum(b.correlation, 2)}</td><td><DivBar value={b.correlation} max={1} width={60} /></td></tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
      {fa?.ceo && (
        <>
          <div className="section-title">Company</div>
          <div className="kv-list" style={{ paddingBottom: 10 }}>
            <div><span>CEO</span><span>{fa.ceo}</span></div>
            <div><span>Headquarters</span><span>{fa.headquarters}</span></div>
            <div><span>Employees</span><span>{fmtNum(fa.employees, 0)}</span></div>
            <div><span>Founded</span><span>{fa.founded}</span></div>
            <div><span>Industry</span><span>{fa.industry}</span></div>
          </div>
        </>
      )}
    </div>
  );
}
