import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { useMarket } from '../store/market';
import { Loading, Empty } from '../components/common';
import { fmtCompact, fmtNum, fmtPct, fmtPrice, signClass } from '../lib/format';

interface Q { period: string; revenue: number; grossProfit: number; operatingIncome: number; netIncome: number; eps: number; epsEstimate: number; surprise: number }
interface Fa {
  type: string; marketCap: number; sharesOutstanding: number; pe: number | null; forwardPe: number | null; peg: number | null; eps: number; priceToBook: number; priceToSales: number; evToEbitda: number;
  dividendYield: number; payoutRatio: number; roe: number; roa: number; debtToEquity: number; currentRatio: number; grossMargin: number; operatingMargin: number; netMargin: number;
  revenueTtm: number; revenueGrowth: number; shortInterest: number; floatPct: number; quarters: Q[];
  analyst: { buy: number; hold: number; sell: number; consensus: string; targetMean: number; targetHigh: number; targetLow: number };
  holders: { name: string; pct: number }[];
}

function Bars({ data, label, fmt }: { data: { k: string; v: number; v2?: number }[]; label: string; fmt: (v: number) => string }) {
  const max = Math.max(...data.map((d) => Math.max(Math.abs(d.v), Math.abs(d.v2 ?? 0))), 1e-9);
  return (
    <div style={{ padding: '0 10px' }}>
      <div className="muted" style={{ fontSize: 10, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
        {data.map((d) => (
          <div key={d.k} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, height: '100%', justifyContent: 'flex-end' }} title={`${d.k}: ${fmt(d.v)}${d.v2 !== undefined ? ` (est ${fmt(d.v2)})` : ''}`}>
            <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end', height: '100%' }}>
              {d.v2 !== undefined && <div style={{ flex: 1, height: `${(Math.abs(d.v2) / max) * 100}%`, background: 'var(--bg-4)', borderRadius: '2px 2px 0 0' }} />}
              <div style={{ flex: 1, height: `${(Math.abs(d.v) / max) * 100}%`, background: d.v2 !== undefined ? (d.v >= d.v2 ? 'var(--up)' : 'var(--down)') : 'var(--amber)', borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
            </div>
            <span className="mono muted" style={{ fontSize: 8.5, whiteSpace: 'nowrap' }}>{d.k.slice(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Financials({ p }: PanelProps) {
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const { data } = useApi<Fa>(`/fundamentals/${encodeURIComponent(p.symbol)}`, 30_000);
  if (!data) return <Loading />;
  if (data.type !== 'equity' && data.type !== 'etf') return <Empty>Financial statements are available for equities. Try <span className="mono amber">AAPL FA</span>.</Empty>;
  if (!data.quarters) return <Empty>No fundamentals for this ETF — see DES for risk statistics.</Empty>;
  const qs = data.quarters.slice(-8);
  const a = data.analyst;
  const total = a.buy + a.hold + a.sell;
  const ccy = inst?.currency ?? '';
  return (
    <div>
      <div className="kpis">
        {[
          ['Revenue TTM', `${fmtCompact(data.revenueTtm)} ${ccy}`, <span className={signClass(data.revenueGrowth)}>{fmtPct(data.revenueGrowth, 1)} YoY</span>],
          ['Gross margin', `${fmtNum(data.grossMargin, 1)}%`, <span className="muted">Op {fmtNum(data.operatingMargin, 1)}%</span>],
          ['Net margin', `${fmtNum(data.netMargin, 1)}%`, <span className="muted">ROE {fmtNum(data.roe, 1)}%</span>],
          ['P/E · Fwd', `${fmtNum(data.pe, 1)} · ${fmtNum(data.forwardPe, 1)}`, <span className="muted">PEG {fmtNum(data.peg, 2)}</span>],
          ['EV/EBITDA', fmtNum(data.evToEbitda, 1), <span className="muted">P/S {fmtNum(data.priceToSales, 1)}</span>],
          ['Debt/Equity', fmtNum(data.debtToEquity, 2), <span className="muted">Current {fmtNum(data.currentRatio, 2)}</span>],
        ].map(([l, v, s], i) => <div className="kpi" key={i}><div className="l">{l}</div><div className="v">{v}</div><div className="s">{s}</div></div>)}
      </div>
      <div className="cols-2" style={{ paddingTop: 8 }}>
        <Bars label={`Revenue (${ccy})`} data={qs.map((q) => ({ k: q.period, v: q.revenue }))} fmt={(v) => fmtCompact(v)} />
        <Bars label="EPS — actual vs estimate" data={qs.map((q) => ({ k: q.period, v: q.eps, v2: q.epsEstimate }))} fmt={(v) => fmtNum(v, 2)} />
      </div>
      <div className="section-title">Quarterly results</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="grid">
          <thead><tr><th>Period</th>{qs.map((q) => <th key={q.period} className="num">{q.period}</th>)}</tr></thead>
          <tbody>
            <tr><td>Revenue</td>{qs.map((q) => <td key={q.period} className="num mono">{fmtCompact(q.revenue)}</td>)}</tr>
            <tr><td>Gross profit</td>{qs.map((q) => <td key={q.period} className="num mono dim">{fmtCompact(q.grossProfit)}</td>)}</tr>
            <tr><td>Operating income</td>{qs.map((q) => <td key={q.period} className="num mono dim">{fmtCompact(q.operatingIncome)}</td>)}</tr>
            <tr><td>Net income</td>{qs.map((q) => <td key={q.period} className={`num mono ${signClass(q.netIncome)}`}>{fmtCompact(q.netIncome)}</td>)}</tr>
            <tr><td>EPS</td>{qs.map((q) => <td key={q.period} className="num mono b">{fmtNum(q.eps, 2)}</td>)}</tr>
            <tr><td>EPS estimate</td>{qs.map((q) => <td key={q.period} className="num mono muted">{fmtNum(q.epsEstimate, 2)}</td>)}</tr>
            <tr><td>Surprise</td>{qs.map((q) => <td key={q.period} className={`num mono ${signClass(q.surprise)}`}>{fmtPct(q.surprise, 1)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <div className="cols-2">
        <div>
          <div className="section-title">Analyst recommendations</div>
          <div style={{ padding: '0 10px' }}>
            <div style={{ display: 'flex', height: 10, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${(a.buy / total) * 100}%`, background: 'var(--up)' }} />
              <div style={{ width: `${(a.hold / total) * 100}%`, background: '#59606b' }} />
              <div style={{ width: `${(a.sell / total) * 100}%`, background: 'var(--down)' }} />
            </div>
            <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
              <span className="up">BUY {a.buy}</span><span className="dim">HOLD {a.hold}</span><span className="down">SELL {a.sell}</span>
            </div>
          </div>
          <div className="kv-list" style={{ marginTop: 6 }}>
            <div><span>Consensus</span><span className={a.consensus === 'BUY' ? 'up' : a.consensus === 'SELL' ? 'down' : ''}>{a.consensus}</span></div>
            <div><span>Target mean</span><span>{fmtPrice(a.targetMean, inst)}</span></div>
            <div><span>Target range</span><span>{fmtPrice(a.targetLow, inst)} – {fmtPrice(a.targetHigh, inst)}</span></div>
            <div><span>Short interest</span><span>{fmtNum(data.shortInterest, 2)}% of float</span></div>
            <div><span>Dividend · payout</span><span>{fmtNum(data.dividendYield, 2)}% · {fmtNum(data.payoutRatio, 0)}%</span></div>
          </div>
        </div>
        <div>
          <div className="section-title">Top holders</div>
          <table className="grid"><tbody>
            {data.holders.map((h) => (
              <tr key={h.name}><td>{h.name}</td><td className="num mono">{fmtNum(h.pct, 2)}%</td><td><div className="bar-track" style={{ width: 70 }}><div className="bar-fill" style={{ width: `${(h.pct / data.holders[0].pct) * 100}%`, background: 'var(--blue)' }} /></div></td></tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
