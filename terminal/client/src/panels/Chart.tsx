import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart, CrosshairMode, LineStyle,
  type IChartApi, type ISeriesApi, type UTCTimestamp, type SeriesType, type LogicalRange,
} from 'lightweight-charts';
import type { PanelProps } from './registry';
import { api } from '../lib/api';
import { useMarket } from '../store/market';
import type { Bar, Quote } from '../lib/types';
import { sma, ema, bollinger, vwap, rsi, macd, heikinAshi, atr, type Point } from '../lib/indicators';
import { fmtCompact, fmtPrice, fmtPct, signClass } from '../lib/format';
import { Seg } from '../components/common';

type Interval = '1m' | '5m' | '15m' | '1h' | '1D' | '1W' | '1M';
type ChartType = 'candle' | 'ha' | 'bar' | 'line' | 'area';
type Lower = 'VOL' | 'RSI' | 'MACD' | 'ATR';
const INTERVAL_SEC: Record<Interval, number> = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1D': 86400, '1W': 604800, '1M': 2592000 };
const OVERLAYS = ['SMA20', 'SMA50', 'SMA200', 'EMA20', 'BB', 'VWAP'] as const;
const OVERLAY_COLORS: Record<string, string> = { SMA20: '#ff9f1a', SMA50: '#3d8bfd', SMA200: '#a774ff', EMA20: '#2ec5d3', BB: '#8a93a0', VWAP: '#f5d547' };
const TZ = -new Date().getTimezoneOffset() * 60;

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function chartOptions() {
  return {
    autoSize: true,
    layout: { background: { color: 'transparent' }, textColor: '#8b94a1', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 },
    grid: { vertLines: { color: 'rgba(255,255,255,0.035)' }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#59606b', labelBackgroundColor: '#2b313b' }, horzLine: { color: '#59606b', labelBackgroundColor: '#2b313b' } },
    rightPriceScale: { borderColor: '#20252d' },
    timeScale: { borderColor: '#20252d', rightOffset: 6, barSpacing: 7 },
  };
}

export default function Chart({ p, setParams }: PanelProps) {
  const params = (p.params || {}) as { interval?: Interval; type?: ChartType; overlays?: string[]; lower?: Lower };
  const interval: Interval = params.interval || '1D';
  const type: ChartType = params.type || 'candle';
  const overlays = params.overlays || ['SMA20', 'SMA50'];
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const hasVolume = inst ? !['index', 'fx', 'rate'].includes(inst.type) : true;
  const lower: Lower = params.lower || (hasVolume ? 'VOL' : 'RSI');

  const mainRef = useRef<HTMLDivElement>(null);
  const lowerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const lowerChartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const barsRef = useRef<Bar[]>([]);
  const lastVolRef = useRef<number | null>(null);
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [legend, setLegend] = useState<Bar | null>(null);
  const [error, setError] = useState<string | null>(null);

  const intraday = INTERVAL_SEC[interval] < 86400;
  const shift = (t: number) => (intraday ? t + TZ : t) as UTCTimestamp;

  // Load history
  useEffect(() => {
    let cancelled = false;
    setBars(null);
    setError(null);
    const load = () => api.get<{ bars: Bar[] }>(`/history/${encodeURIComponent(p.symbol)}?interval=${interval}&limit=${intraday ? 2000 : 1500}`)
      .then((r) => { if (!cancelled) setBars(r.bars); })
      .catch((e) => !cancelled && setError(e.message));
    load();
    const id = setInterval(load, intraday ? 120_000 : 600_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [p.symbol, interval, intraday]);

  // Build charts
  useEffect(() => {
    if (!bars || !mainRef.current || !lowerRef.current) return;
    const up = css('--up') || '#19c37d';
    const down = css('--down') || '#f04d55';
    const decimals = inst?.decimals ?? 2;
    const priceFormat = { type: 'price' as const, precision: decimals, minMove: inst?.tick ?? 0.01 };

    const chart = createChart(mainRef.current, { ...chartOptions(), timeScale: { ...chartOptions().timeScale, timeVisible: intraday, secondsVisible: false } });
    chartRef.current = chart;
    const data = type === 'ha' ? heikinAshi(bars) : bars;
    barsRef.current = bars.map((b) => ({ ...b }));
    let series: ISeriesApi<SeriesType>;
    if (type === 'line') {
      series = chart.addLineSeries({ color: '#ff9f1a', lineWidth: 2, priceFormat });
      series.setData(bars.map((b) => ({ time: shift(b.t), value: b.c })));
    } else if (type === 'area') {
      series = chart.addAreaSeries({ lineColor: '#ff9f1a', topColor: 'rgba(255,159,26,0.28)', bottomColor: 'rgba(255,159,26,0.02)', lineWidth: 2, priceFormat });
      series.setData(bars.map((b) => ({ time: shift(b.t), value: b.c })));
    } else if (type === 'bar') {
      series = chart.addBarSeries({ upColor: up, downColor: down, thinBars: false, priceFormat });
      series.setData(data.map((b) => ({ time: shift(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    } else {
      series = chart.addCandlestickSeries({ upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down, priceFormat });
      series.setData(data.map((b) => ({ time: shift(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    }
    seriesRef.current = series;

    // Prior close line for intraday views
    const q = useMarket.getState().quotes[p.symbol];
    if (q && intraday) series.createPriceLine({ price: q.prevClose, color: '#59606b', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: 'PREV' });

    const addLine = (pts: Point[], color: string, width = 1, style = LineStyle.Solid) => {
      const s = chart.addLineSeries({ color, lineWidth: width as 1 | 2, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false, priceFormat });
      s.setData(pts.map((x) => ({ time: shift(x.time), value: x.value })));
    };
    for (const o of overlays) {
      if (o === 'SMA20') addLine(sma(bars, 20), OVERLAY_COLORS[o]);
      if (o === 'SMA50') addLine(sma(bars, 50), OVERLAY_COLORS[o]);
      if (o === 'SMA200') addLine(sma(bars, 200), OVERLAY_COLORS[o]);
      if (o === 'EMA20') addLine(ema(bars, 20), OVERLAY_COLORS[o]);
      if (o === 'VWAP' && intraday) addLine(vwap(bars), OVERLAY_COLORS[o], 1, LineStyle.Dashed);
      if (o === 'BB') {
        const bb = bollinger(bars);
        addLine(bb.upper, OVERLAY_COLORS.BB, 1, LineStyle.Dotted);
        addLine(bb.mid, OVERLAY_COLORS.BB, 1, LineStyle.Dashed);
        addLine(bb.lower, OVERLAY_COLORS.BB, 1, LineStyle.Dotted);
      }
    }

    // Lower pane
    const lc = createChart(lowerRef.current, { ...chartOptions(), layout: { ...chartOptions().layout, attributionLogo: false }, timeScale: { ...chartOptions().timeScale, timeVisible: intraday, visible: true } });
    lowerChartRef.current = lc;
    volRef.current = null;
    if (lower === 'VOL') {
      const v = lc.addHistogramSeries({ priceFormat: { type: 'volume' }, priceLineVisible: false });
      v.setData(bars.map((b) => ({ time: shift(b.t), value: b.v, color: b.c >= b.o ? 'rgba(25,195,125,0.45)' : 'rgba(240,77,85,0.45)' })));
      volRef.current = v;
    } else if (lower === 'RSI') {
      const s = lc.addLineSeries({ color: '#a774ff', lineWidth: 1, priceLineVisible: false });
      s.setData(rsi(bars).map((x) => ({ time: shift(x.time), value: x.value })));
      s.createPriceLine({ price: 70, color: 'rgba(240,77,85,0.5)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
      s.createPriceLine({ price: 30, color: 'rgba(25,195,125,0.5)', lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false, title: '' });
    } else if (lower === 'MACD') {
      const m = macd(bars);
      const h = lc.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
      h.setData(m.hist.map((x) => ({ time: shift(x.time), value: x.value, color: x.value >= 0 ? 'rgba(25,195,125,0.55)' : 'rgba(240,77,85,0.55)' })));
      const l1 = lc.addLineSeries({ color: '#3d8bfd', lineWidth: 1, priceLineVisible: false });
      l1.setData(m.line.map((x) => ({ time: shift(x.time), value: x.value })));
      const l2 = lc.addLineSeries({ color: '#ff9f1a', lineWidth: 1, priceLineVisible: false });
      l2.setData(m.signal.map((x) => ({ time: shift(x.time), value: x.value })));
    } else if (lower === 'ATR') {
      const s = lc.addLineSeries({ color: '#2ec5d3', lineWidth: 1, priceLineVisible: false, priceFormat });
      s.setData(atr(bars).map((x) => ({ time: shift(x.time), value: x.value })));
    }

    // Sync the two time scales
    let syncing = false;
    const sync = (to: IChartApi) => (range: LogicalRange | null) => {
      if (syncing || !range) return;
      syncing = true;
      to.timeScale().setVisibleLogicalRange(range);
      syncing = false;
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(sync(lc));
    lc.timeScale().subscribeVisibleLogicalRangeChange(sync(chart));
    const n = bars.length;
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - (intraday ? 240 : 180)), to: n + 4 });

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) { setLegend(null); return; }
      const t = (param.time as number) - (intraday ? TZ : 0);
      const b = barsRef.current.find((x) => x.t === t);
      setLegend(b ?? null);
    });

    lastVolRef.current = useMarket.getState().quotes[p.symbol]?.volume ?? null;
    return () => {
      chart.remove();
      lc.remove();
      chartRef.current = null;
      lowerChartRef.current = null;
      seriesRef.current = null;
      volRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, type, overlays.join(','), lower, inst?.decimals]);

  // Stream live quotes into the last bar
  useEffect(() => {
    const sec = INTERVAL_SEC[interval];
    const onQuote = (q: Quote) => {
      const series = seriesRef.current;
      const arr = barsRef.current;
      if (!series || !arr.length) return;
      const now = Math.floor(Date.now() / 1000);
      let bucket = Math.floor(now / sec) * sec;
      if (interval === '1W' || interval === '1M') bucket = arr[arr.length - 1].t;
      const prevVol = lastVolRef.current;
      const dv = prevVol !== null && q.volume >= prevVol ? q.volume - prevVol : 0;
      lastVolRef.current = q.volume;
      let last = arr[arr.length - 1];
      if (bucket > last.t) {
        last = { t: bucket, o: last.c, h: q.last, l: q.last, c: q.last, v: 0 };
        arr.push(last);
      }
      last.h = Math.max(last.h, q.last);
      last.l = Math.min(last.l, q.last);
      last.c = q.last;
      last.v += dv;
      const time = shift(last.t);
      try {
        if (type === 'line' || type === 'area') (series as ISeriesApi<'Line'>).update({ time, value: last.c });
        else if (type === 'ha') {
          const prev = arr[arr.length - 2];
          const c = (last.o + last.h + last.l + last.c) / 4;
          const o = prev ? (prev.o + prev.c) / 2 : last.o;
          (series as ISeriesApi<'Candlestick'>).update({ time, open: o, high: Math.max(last.h, o, c), low: Math.min(last.l, o, c), close: c });
        } else (series as ISeriesApi<'Candlestick'>).update({ time, open: last.o, high: last.h, low: last.l, close: last.c });
        volRef.current?.update({ time, value: last.v, color: last.c >= last.o ? 'rgba(25,195,125,0.45)' : 'rgba(240,77,85,0.45)' });
      } catch { /* out-of-order update after reload */ }
    };
    let prev = useMarket.getState().quotes[p.symbol];
    return useMarket.subscribe((s) => {
      const q = s.quotes[p.symbol];
      if (q && q !== prev) {
        prev = q;
        onQuote(q);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.symbol, interval, type, bars]);

  const toggleOverlay = (o: string) => setParams({ overlays: overlays.includes(o) ? overlays.filter((x) => x !== o) : [...overlays, o] });
  const q = useMarket((s) => s.quotes[p.symbol]);
  const shown = legend ?? (bars && bars.length ? bars[bars.length - 1] : null);
  const legendChange = useMemo(() => (shown ? ((shown.c - shown.o) / shown.o) * 100 : 0), [shown]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <Seg value={interval} options={['1m', '5m', '15m', '1h', '1D', '1W', '1M']} onChange={(v) => setParams({ interval: v })} />
        <Seg value={type} options={[['candle', 'Candle'], ['ha', 'HA'], ['bar', 'OHLC'], ['line', 'Line'], ['area', 'Area']]} onChange={(v) => setParams({ type: v })} />
        {OVERLAYS.map((o) => (
          <span key={o} className={`chip ${overlays.includes(o) ? 'on' : ''}`} style={overlays.includes(o) ? { borderColor: OVERLAY_COLORS[o], color: OVERLAY_COLORS[o], background: 'transparent' } : undefined} onClick={() => toggleOverlay(o)}>{o}</span>
        ))}
        <span className="spacer" />
        <Seg value={lower} options={['VOL', 'RSI', 'MACD', 'ATR']} onChange={(v) => setParams({ lower: v })} />
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        {shown && (
          <div className="mono" style={{ position: 'absolute', zIndex: 3, top: 6, left: 8, fontSize: 10.5, display: 'flex', flexWrap: 'wrap', maxWidth: 'calc(100% - 80px)', columnGap: 10, pointerEvents: 'none', background: 'rgba(12,14,17,.7)', padding: '2px 6px', borderRadius: 4 }}>
            <span className="amber b">{p.symbol} · {interval}</span>
            <span><span className="muted">O</span> {fmtPrice(shown.o, inst)}</span>
            <span><span className="muted">H</span> {fmtPrice(shown.h, inst)}</span>
            <span><span className="muted">L</span> {fmtPrice(shown.l, inst)}</span>
            <span><span className="muted">C</span> <span className={signClass(legendChange)}>{fmtPrice(shown.c, inst)}</span></span>
            <span className={signClass(legendChange)}>{fmtPct(legendChange)}</span>
            {shown.v > 0 && <span><span className="muted">V</span> {fmtCompact(shown.v)}</span>}
            {!legend && q && <span className="muted">BID {fmtPrice(q.bid, inst)} / ASK {fmtPrice(q.ask, inst)}</span>}
          </div>
        )}
        {error && <div className="empty">{error}</div>}
        {!bars && !error && <div className="loading" style={{ position: 'absolute', inset: 0 }} />}
        <div ref={mainRef} style={{ position: 'absolute', inset: 0 }} />
      </div>
      <div ref={lowerRef} style={{ height: '24%', minHeight: 70, borderTop: '1px solid var(--line)' }} />
    </div>
  );
}
