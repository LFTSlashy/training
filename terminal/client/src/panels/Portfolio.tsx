import { useEffect, useMemo, useRef } from 'react';
import { createChart, type IChartApi, type UTCTimestamp } from 'lightweight-charts';
import type { PanelProps } from './registry';
import { useAccount } from '../store/account';
import { useMarket } from '../store/market';
import { useApi, useSort } from '../lib/hooks';
import { api } from '../lib/api';
import { toast } from '../store/toasts';
import { fmtPct, fmtPrice, fmtQty, fmtUsd, signClass, fmtChange } from '../lib/format';
import { Kpi, Th, Empty } from '../components/common';
import type { Position } from '../lib/types';

function EquityCurve() {
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useApi<{ t: number; equity: number }[]>('/account/equity', 60_000);
  useEffect(() => {
    if (!ref.current || !data || data.length < 2) return;
    const chart: IChartApi = createChart(ref.current, {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: '#8b94a1', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
      rightPriceScale: { borderColor: '#20252d' },
      timeScale: { borderColor: '#20252d', timeVisible: true },
      handleScroll: false, handleScale: false,
    });
    const up = data[data.length - 1].equity >= data[0].equity;
    const s = chart.addAreaSeries({ lineColor: up ? '#19c37d' : '#f04d55', topColor: up ? 'rgba(25,195,125,.25)' : 'rgba(240,77,85,.25)', bottomColor: 'rgba(0,0,0,0)', lineWidth: 2, priceFormat: { type: 'price', precision: 0, minMove: 1 } });
    const tz = -new Date().getTimezoneOffset() * 60;
    const seen = new Set<number>();
    s.setData(data.map((d) => ({ time: (Math.floor(d.t / 1000) + tz) as UTCTimestamp, value: d.equity })).filter((d) => !seen.has(d.time) && seen.add(d.time)));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);
  if (!data || data.length < 2) return <div className="empty" style={{ height: 120 }}>Equity curve builds as you trade (sampled every minute).</div>;
  return <div ref={ref} style={{ height: 130 }} />;
}

export default function Portfolio({ load }: PanelProps) {
  const summary = useAccount((s) => s.summary);
  const positions = useAccount((s) => s.positions);
  const refreshPositions = useAccount((s) => s.refreshPositions);
  const quotes = useMarket((s) => s.quotes);
  const instruments = useMarket((s) => s.instruments);

  // Mark positions to market on the client between server refreshes.
  const marked = useMemo<Position[]>(() => positions.map((p) => {
    const q = quotes[p.symbol];
    if (!q) return p;
    const fx = p.costBasis && p.avgPrice ? p.costBasis / (p.qty * p.avgPrice * (instruments[p.symbol]?.multiplier ?? 1)) : 1;
    const mult = instruments[p.symbol]?.multiplier ?? 1;
    const marketValue = p.qty * q.last * mult * fx;
    return { ...p, last: q.last, changePct: q.changePct, marketValue, unrealized: marketValue - p.costBasis, unrealizedPct: ((marketValue - p.costBasis) / Math.abs(p.costBasis || 1)) * 100, dayPnl: p.dayPnl + p.qty * (q.last - p.last) * mult * fx };
  }), [positions, quotes, instruments]);
  const sort = useSort<Position>(marked, 'marketValue');

  useEffect(() => {
    refreshPositions();
    const id = setInterval(refreshPositions, 5000);
    return () => clearInterval(id);
  }, [refreshPositions]);

  const close = async (symbol: string) => {
    try { await api.post(`/positions/${encodeURIComponent(symbol)}/close`); }
    catch (e) { toast({ kind: 'error', title: 'Close failed', body: (e as Error).message }); }
  };
  const s = summary;
  const totalUnreal = marked.reduce((a, b) => a + b.unrealized, 0);
  const maxAbs = Math.max(1, ...marked.map((x) => Math.abs(x.marketValue)));

  return (
    <div>
      {s && (
        <div className="kpis">
          <Kpi label="Net liquidation" value={fmtUsd(s.equity, 0)} sub={<span className={signClass(s.totalPnl)}>{fmtUsd(s.totalPnl)} ({fmtPct(s.totalPnlPct)})</span>} />
          <Kpi label="Day P&L" value={<span className={signClass(s.dayPnl)}>{fmtUsd(s.dayPnl)}</span>} sub={<span className={signClass(s.dayPnl)}>{fmtPct(s.dayPnlPct)}</span>} />
          <Kpi label="Unrealized" value={<span className={signClass(totalUnreal)}>{fmtUsd(totalUnreal)}</span>} sub={<span className="muted">Realized {fmtUsd(s.realized)}</span>} />
          <Kpi label="Cash" value={fmtUsd(s.cash)} sub={<span className="muted">Comm. {fmtUsd(s.commissions, 2)}</span>} />
          <Kpi label="Gross / Net" value={fmtUsd(s.grossExposure)} sub={<span className="muted">Net {fmtUsd(s.netExposure)}</span>} />
          <Kpi label="Leverage" value={`${s.leverage.toFixed(2)}x`} sub={<span className="muted">BP {fmtUsd(s.buyingPower)}</span>} />
        </div>
      )}
      <EquityCurve />
      <div className="section-title">Positions ({marked.length})</div>
      {marked.length === 0 ? <Empty>No open positions. Use TRD or the command line (e.g. <span className="mono amber">BUY MSFT 50</span>).</Empty> : (
        <table className="grid">
          <thead>
            <tr>
              <Th k="symbol" label="Security" sort={sort} />
              <Th k="qty" label="Qty" sort={sort} num />
              <Th k="avgPrice" label="Avg Cost" sort={sort} num />
              <Th k="last" label="Last" sort={sort} num />
              <Th k="changePct" label="Chg" sort={sort} num />
              <Th k="marketValue" label="Mkt Value $" sort={sort} num />
              <th>Weight</th>
              <Th k="dayPnl" label="Day P&L $" sort={sort} num />
              <Th k="unrealized" label="Unreal. $" sort={sort} num />
              <Th k="unrealizedPct" label="Unreal. %" sort={sort} num />
              <th />
            </tr>
          </thead>
          <tbody>
            {sort.sorted.map((p) => {
              const inst = instruments[p.symbol];
              return (
                <tr key={p.symbol} className="clickable" onClick={() => load({ symbol: p.symbol })}>
                  <td className="sym" title={p.name}>{p.symbol}</td>
                  <td className={`num mono ${signClass(p.qty)}`}>{fmtQty(p.qty, inst?.lot)}</td>
                  <td className="num mono">{fmtPrice(p.avgPrice, inst)}</td>
                  <td className="num mono">{fmtPrice(p.last, inst)}</td>
                  <td className={`num mono ${signClass(p.changePct)}`}>{fmtChange(p.changePct, inst)}</td>
                  <td className="num mono">{fmtUsd(p.marketValue)}</td>
                  <td><div className="bar-track" style={{ width: 70 }}><div className="bar-fill" style={{ width: `${(Math.abs(p.marketValue) / maxAbs) * 100}%`, background: p.marketValue >= 0 ? 'var(--blue)' : 'var(--purple)' }} /></div></td>
                  <td className={`num mono ${signClass(p.dayPnl)}`}>{fmtUsd(p.dayPnl)}</td>
                  <td className={`num mono ${signClass(p.unrealized)}`}>{fmtUsd(p.unrealized)}</td>
                  <td className={`num mono ${signClass(p.unrealizedPct)}`}>{fmtPct(p.unrealizedPct)}</td>
                  <td><button className="btn sm" onClick={(e) => { e.stopPropagation(); close(p.symbol); }}>Close</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
