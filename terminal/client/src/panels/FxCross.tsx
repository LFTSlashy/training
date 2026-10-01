import type { PanelProps } from './registry';
import { useApi } from '../lib/hooks';
import { useMarket } from '../store/market';
import { Loading, heatColor } from '../components/common';
import { fmtNum, fmtPct, signClass } from '../lib/format';
import { useEffect, useMemo, useState } from 'react';

interface Matrix { currencies: string[]; rates: number[][]; changes: number[][] }

const decimals = (v: number) => (v >= 100 ? 2 : v >= 10 ? 3 : 4);

export default function FxCross({ load }: PanelProps) {
  const { data, reload } = useApi<Matrix>('/fx/matrix');
  const tick = useMarket((s) => s.lastTick);
  const [last, setLast] = useState(0);
  const [mode, setMode] = useState<'rate' | 'chg'>('rate');
  useEffect(() => {
    if (tick - last > 2000) { setLast(tick); reload(); }
  }, [tick, last, reload]);
  const list = useMarket((s) => s.list);
  const fxList = useMemo(() => list.filter((i) => i.type === 'fx'), [list]);
  const quotes = useMarket((s) => s.quotes);
  if (!data) return <Loading />;
  const open = (a: string, b: string) => {
    const s = fxList.find((i) => (i.base === a && i.currency === b) || (i.base === b && i.currency === a) || (i.symbol === 'USDCNH' && ((a === 'USD' && b === 'CNY') || (a === 'CNY' && b === 'USD'))));
    if (s) load({ symbol: s.symbol, fn: 'GP' });
  };
  return (
    <div>
      <div className="toolbar">
        <div className="seg">
          <button className={mode === 'rate' ? 'on' : ''} onClick={() => setMode('rate')}>Rates</button>
          <button className={mode === 'chg' ? 'on' : ''} onClick={() => setMode('chg')}>% Change</button>
        </div>
        <span className="muted" style={{ fontSize: 11 }}>Row currency priced in column currency · click a major to chart</span>
      </div>
      <table className="grid">
        <thead><tr><th />{data.currencies.map((c) => <th key={c} className="num">{c}</th>)}</tr></thead>
        <tbody>
          {data.currencies.map((row, i) => (
            <tr key={row}>
              <td className="sym">{row}</td>
              {data.currencies.map((col, j) => {
                if (i === j) return <td key={col} className="num muted" style={{ background: 'var(--bg-2)' }}>—</td>;
                const v = data.rates[i][j], ch = data.changes[i][j];
                return (
                  <td key={col} className="num mono clickable" style={{ background: mode === 'chg' ? heatColor(ch, 0.8) : undefined, cursor: 'pointer' }} onClick={() => open(row, col)} title={`${row}/${col} ${fmtPct(ch, 3)}`}>
                    {mode === 'rate' ? <span className={signClass(ch)}>{fmtNum(v, decimals(v))}</span> : fmtPct(ch, 2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="section-title">Majors</div>
      <table className="grid">
        <thead><tr><th>Pair</th><th className="num">Bid</th><th className="num">Ask</th><th className="num">Spread (pips)</th><th className="num">%Chg</th><th className="num">High</th><th className="num">Low</th></tr></thead>
        <tbody>
          {fxList.map((i) => {
            const q = quotes[i.symbol];
            if (!q) return null;
            const pip = i.currency === 'JPY' ? 0.01 : 0.0001;
            return (
              <tr key={i.symbol} className="clickable" onClick={() => load({ symbol: i.symbol })}>
                <td className="sym">{i.symbol}</td>
                <td className="num mono">{fmtNum(q.bid, i.decimals)}</td>
                <td className="num mono">{fmtNum(q.ask, i.decimals)}</td>
                <td className="num mono muted">{fmtNum((q.ask - q.bid) / pip, 1)}</td>
                <td className={`num mono ${signClass(q.changePct)}`}>{fmtPct(q.changePct)}</td>
                <td className="num mono dim">{fmtNum(q.high, i.decimals)}</td>
                <td className="num mono dim">{fmtNum(q.low, i.decimals)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
