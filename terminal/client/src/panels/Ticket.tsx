import { useEffect, useMemo, useState } from 'react';
import type { PanelProps } from './registry';
import { useMarket } from '../store/market';
import { useAccount } from '../store/account';
import { api } from '../lib/api';
import { toast } from '../store/toasts';
import type { Order, OrderSide, OrderType, Tif } from '../lib/types';
import { fmtPrice, fmtQty, fmtUsd, fmtChange, signClass, fmtNum } from '../lib/format';
import { Seg } from '../components/common';

export default function Ticket({ p }: PanelProps) {
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const q = useMarket((s) => s.quotes[p.symbol]);
  const fx = useMarket((s) => {
    const c = inst?.currency;
    if (!c || c === 'USD') return 1;
    const d = s.quotes[`${c}USD`];
    if (d) return d.last;
    const i = s.quotes[c === 'CNY' ? 'USDCNH' : `USD${c}`];
    return i ? 1 / i.last : 1;
  });
  const summary = useAccount((s) => s.summary);
  const position = useAccount((s) => s.positions.find((x) => x.symbol === p.symbol));
  const orders = useAccount((s) => s.orders);
  const working = useMemo(() => orders.filter((o) => o.symbol === p.symbol && ['WORKING', 'PARTIAL', 'PENDING_TRIGGER'].includes(o.status)), [orders, p.symbol]);

  const defaultQty = useMemo(() => {
    if (!inst) return 100;
    if (inst.type === 'fx') return 100000;
    if (inst.type === 'crypto') return inst.lot >= 1 ? 1000 : Number((Math.max(inst.lot, 5000 / (q?.last || 1))).toFixed(Math.ceil(-Math.log10(inst.lot))));
    if (inst.type === 'commodity' || inst.type === 'index') return 1;
    return Math.max(inst.lot, 100);
  }, [inst, q?.last === undefined]);

  const [side, setSide] = useState<OrderSide>('BUY');
  const [type, setType] = useState<OrderType>('LMT');
  const [tif, setTif] = useState<Tif>('DAY');
  const [qty, setQty] = useState<string>(String(defaultQty));
  const [limit, setLimit] = useState<string>('');
  const [stop, setStop] = useState<string>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setQty(String(defaultQty));
    setLimit('');
    setStop('');
  }, [p.symbol, defaultQty]);

  // Prefill limit price from touch when empty
  useEffect(() => {
    if (q && !limit && (type === 'LMT' || type === 'STP_LMT')) setLimit(String(side === 'BUY' ? q.bid : q.ask));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, side, p.symbol, q === undefined]);

  if (!inst || !q) return <div className="loading" />;
  if (!inst.tradable) return <div className="empty">{p.symbol} is a reference series and is not tradable.<br />Try an ETF (TLT for rates, SPY for SPX) or a futures/CFD.</div>;

  const qtyN = Number(qty) || 0;
  const px = type === 'MKT' || type === 'STP' ? (side === 'BUY' ? q.ask : q.bid) : Number(limit) || 0;
  const notional = qtyN * px * inst.multiplier * fx;
  const tick = inst.tick;
  const bump = (setter: (v: string) => void, val: string, dir: number) => {
    const v = (Number(val) || (side === 'BUY' ? q.bid : q.ask)) + dir * tick;
    setter(v.toFixed(inst.decimals));
  };
  const qtyStep = inst.type === 'fx' ? 10000 : inst.lot < 1 ? inst.lot * 10 : inst.type === 'equity' || inst.type === 'etf' ? inst.lot * (inst.lot > 1 ? 1 : 10) : 1;

  const submit = async () => {
    setBusy(true);
    try {
      const o = await api.post<Order>('/orders', {
        symbol: p.symbol, side, type, qty: qtyN, tif: type === 'MKT' && tif !== 'IOC' && tif !== 'FOK' ? 'IOC' : tif,
        limitPrice: type === 'LMT' || type === 'STP_LMT' ? Number(limit) : undefined,
        stopPrice: type === 'STP' || type === 'STP_LMT' ? Number(stop) : undefined,
      });
      if (o.status !== 'FILLED') toast({ kind: 'info', title: `${side} ${fmtQty(qtyN, inst.lot)} ${p.symbol} ${type.replace('_', ' ')}`, body: `${o.status}${o.avgFillPrice ? ` @ ${fmtPrice(o.avgFillPrice, inst)}` : ''} · ${o.id}` });
    } catch (e) {
      toast({ kind: 'error', title: 'Order rejected', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const cancelAll = async () => {
    const r = await api.post<{ cancelled: number }>('/orders/cancel-all', { symbol: p.symbol });
    toast({ kind: 'info', title: `Cancelled ${r.cancelled} order(s) in ${p.symbol}` });
  };
  const flatten = async () => {
    try {
      await api.post(`/positions/${encodeURIComponent(p.symbol)}/close`);
    } catch (e) {
      toast({ kind: 'error', title: 'Close failed', body: (e as Error).message });
    }
  };

  const sideColor = side === 'BUY' ? 'var(--up)' : 'var(--down)';
  return (
    <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <button className="btn" style={{ height: 52, flexDirection: 'column', gap: 0, borderColor: side === 'SELL' ? 'var(--down)' : undefined, background: side === 'SELL' ? 'var(--down-bg)' : undefined }} onClick={() => { setSide('SELL'); setLimit(String(q.ask)); }}>
          <span style={{ fontSize: 10, color: 'var(--down)', letterSpacing: '.1em' }}>SELL · BID</span>
          <span className="mono" style={{ fontSize: 17, color: 'var(--down)' }}>{fmtPrice(q.bid, inst)}</span>
        </button>
        <button className="btn" style={{ height: 52, flexDirection: 'column', gap: 0, borderColor: side === 'BUY' ? 'var(--up)' : undefined, background: side === 'BUY' ? 'var(--up-bg)' : undefined }} onClick={() => { setSide('BUY'); setLimit(String(q.bid)); }}>
          <span style={{ fontSize: 10, color: 'var(--up)', letterSpacing: '.1em' }}>BUY · ASK</span>
          <span className="mono" style={{ fontSize: 17, color: 'var(--up)' }}>{fmtPrice(q.ask, inst)}</span>
        </button>
      </div>
      <div className="mono" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span className="muted">{inst.assetClass} · {inst.currency}{inst.multiplier !== 1 ? ` · x${inst.multiplier}` : ''} · lot {inst.lot}</span>
        <span className={signClass(q.changePct)}>{fmtChange(q.changePct, inst)}</span>
      </div>

      <Seg value={type} options={[['MKT', 'Market'], ['LMT', 'Limit'], ['STP', 'Stop'], ['STP_LMT', 'Stop Lmt']]} onChange={setType} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>Quantity</label>
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="btn sm" onClick={() => setQty(String(Math.max(inst.lot, qtyN - qtyStep)))}>−</button>
            <input className="input" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} />
            <button className="btn sm" onClick={() => setQty(String(Number((qtyN + qtyStep).toFixed(6))))}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Time in force</label>
          <select className="input" value={tif} onChange={(e) => setTif(e.target.value as Tif)}>
            {(type === 'MKT' ? ['IOC', 'FOK'] : ['DAY', 'GTC', 'IOC', 'FOK']).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Limit price</label>
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="btn sm" disabled={type === 'MKT' || type === 'STP'} onClick={() => bump(setLimit, limit, -1)}>−</button>
            <input className="input" disabled={type === 'MKT' || type === 'STP'} value={type === 'MKT' || type === 'STP' ? '' : limit} placeholder={type === 'MKT' || type === 'STP' ? 'MARKET' : ''} onChange={(e) => setLimit(e.target.value)} />
            <button className="btn sm" disabled={type === 'MKT' || type === 'STP'} onClick={() => bump(setLimit, limit, 1)}>+</button>
          </div>
        </div>
        <div className="field">
          <label>Stop price</label>
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="btn sm" disabled={type !== 'STP' && type !== 'STP_LMT'} onClick={() => bump(setStop, stop, -1)}>−</button>
            <input className="input" disabled={type !== 'STP' && type !== 'STP_LMT'} value={stop} onChange={(e) => setStop(e.target.value)} />
            <button className="btn sm" disabled={type !== 'STP' && type !== 'STP_LMT'} onClick={() => bump(setStop, stop, 1)}>+</button>
          </div>
        </div>
      </div>

      <div className="kv-list" style={{ padding: 0 }}>
        <div><span>Est. notional (USD)</span><span>{fmtUsd(notional, 2)}</span></div>
        <div><span>Buying power</span><span>{fmtUsd(summary?.buyingPower)}</span></div>
        <div><span>% of equity</span><span>{summary ? fmtNum((notional / summary.equity) * 100, 2) : '—'}%</span></div>
        <div><span>Position</span><span className={signClass(position?.qty)}>{position ? `${fmtQty(position.qty, inst.lot)} @ ${fmtPrice(position.avgPrice, inst)}` : 'Flat'}</span></div>
        {position && <div><span>Unrealized P&amp;L</span><span className={signClass(position.unrealized)}>{fmtUsd(position.unrealized, 2)}</span></div>}
      </div>

      <button className={`btn ${side === 'BUY' ? 'buy' : 'sell'}`} style={{ height: 40, fontSize: 13, letterSpacing: '.06em' }} disabled={busy || !qtyN} onClick={submit}>
        {busy ? 'SENDING…' : `${side} ${fmtQty(qtyN, inst.lot)} ${p.symbol} ${type === 'MKT' ? 'AT MARKET' : type === 'LMT' ? `@ ${limit}` : type === 'STP' ? `STOP ${stop}` : `STOP ${stop} LMT ${limit}`}`}
      </button>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn sm ghost" style={{ flex: 1 }} disabled={!working.length} onClick={cancelAll}>Cancel {working.length || ''} working</button>
        <button className="btn sm ghost" style={{ flex: 1, color: sideColor }} disabled={!position} onClick={flatten}>Flatten position</button>
      </div>
    </div>
  );
}
