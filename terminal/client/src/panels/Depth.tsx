import { useEffect } from 'react';
import type { PanelProps } from './registry';
import { feed } from '../lib/feed';
import { useMarket } from '../store/market';
import { useAccount } from '../store/account';
import { fmtCompact, fmtPrice, fmtQty, fmtTime, fmtChange, signClass, fmtNum } from '../lib/format';
import { Loading } from '../components/common';
import { api } from '../lib/api';
import { toast } from '../store/toasts';

export default function Depth({ p }: PanelProps) {
  const book = useMarket((s) => s.books[p.symbol]);
  const tape = useMarket((s) => s.tapes[p.symbol]);
  const q = useMarket((s) => s.quotes[p.symbol]);
  const inst = useMarket((s) => s.instruments[p.symbol]);
  const orders = useAccount((s) => s.orders);

  useEffect(() => {
    const a = feed.subscribe('book', p.symbol);
    const b = feed.subscribe('tape', p.symbol);
    return () => { a(); b(); };
  }, [p.symbol]);

  if (inst?.type === 'rate') return <div className="empty">No order book for yields — use GP or GC.</div>;
  if (!book || !q) return <Loading />;

  const working = orders.filter((o) => o.symbol === p.symbol && ['WORKING', 'PARTIAL', 'PENDING_TRIGGER'].includes(o.status));
  const myAt = (price: number, side: 'BUY' | 'SELL') => working.filter((o) => o.side === side && (o.limitPrice ?? o.stopPrice) === price).reduce((a, o) => a + o.qty - o.filledQty, 0);
  const maxSize = Math.max(...book.bids.map((l) => l.size), ...book.asks.map((l) => l.size));
  let cb = 0, ca = 0;
  const bidCum = book.bids.map((l) => (cb += l.size));
  const askCum = book.asks.map((l) => (ca += l.size));
  const totalBid = cb, totalAsk = ca;
  const imbalance = (totalBid - totalAsk) / (totalBid + totalAsk);
  const lot = inst?.lot ?? 1;

  const clickLevel = async (price: number, side: 'BUY' | 'SELL', e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    // Shift+click on a level places a 1-lot (or default size) limit order — fast "click trading".
    const qty = inst?.type === 'fx' ? 100000 : inst?.type === 'crypto' ? Math.max(lot, Number((1000 / price).toFixed(4))) : Math.max(lot, 100);
    try {
      await api.post('/orders', { symbol: p.symbol, side, type: 'LMT', qty, limitPrice: price, tif: 'DAY' });
      toast({ kind: 'success', title: `${side} ${fmtQty(qty, lot)} ${p.symbol} LMT ${fmtPrice(price, inst)}` });
    } catch (err) {
      toast({ kind: 'error', title: 'Order rejected', body: (err as Error).message });
    }
  };

  const rowsAsk = book.asks.map((l, i) => ({ ...l, cum: askCum[i] })).reverse();
  const rowsBid = book.bids.map((l, i) => ({ ...l, cum: bidCum[i] }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1.35fr) minmax(170px, 1fr)', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderRight: '1px solid var(--line)' }}>
        <div className="kpis" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="kpi"><div className="l">Last</div><div className={`v ${signClass(q.dir)}`}>{fmtPrice(q.last, inst)}</div></div>
          <div className="kpi"><div className="l">Chg</div><div className={`v ${signClass(q.changePct)}`} style={{ fontSize: 12.5 }}>{fmtChange(q.changePct, inst)}</div></div>
          <div className="kpi"><div className="l">Spread</div><div className="v" style={{ fontSize: 12.5 }}>{fmtPrice(book.spread, inst)}</div><div className="s muted">{fmtNum((book.spread / book.mid) * 1e4, 1)} bp</div></div>
          <div className="kpi"><div className="l">Imbalance</div><div className={`v ${signClass(imbalance)}`} style={{ fontSize: 12.5 }}>{fmtNum(imbalance * 100, 0)}%</div></div>
        </div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table className="grid">
            <thead><tr><th className="num">Mine</th><th className="num">Orders</th><th className="num">Size</th><th className="num">Price</th><th className="num">Cum</th></tr></thead>
            <tbody>
              {rowsAsk.map((l) => {
                const mine = myAt(l.price, 'SELL');
                return (
                  <tr key={`a${l.price}`} className="clickable" title="Shift+click to place a sell limit" onClick={(e) => clickLevel(l.price, 'SELL', e)}>
                    <td className="num mono amber">{mine ? fmtQty(mine, lot) : ''}</td>
                    <td className="num mono muted">{l.orders}</td>
                    <td className="num mono" style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', right: 0, top: 2, bottom: 2, width: `${(l.size / maxSize) * 100}%`, background: 'rgba(240,77,85,0.16)' }} />
                      <span style={{ position: 'relative' }}>{fmtCompact(l.size, lot < 1 ? 3 : 1)}</span>
                    </td>
                    <td className="num mono down b">{fmtPrice(l.price, inst)}</td>
                    <td className="num mono muted">{fmtCompact(l.cum, 1)}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={5} style={{ textAlign: 'center', background: 'var(--bg-3)', height: 24 }} className="mono">
                <span className={`b ${signClass(q.dir)}`} style={{ fontSize: 13 }}>{fmtPrice(q.last, inst)}</span>
                <span className="muted"> · mid {fmtPrice(book.mid, inst)}</span>
              </td></tr>
              {rowsBid.map((l) => {
                const mine = myAt(l.price, 'BUY');
                return (
                  <tr key={`b${l.price}`} className="clickable" title="Shift+click to place a buy limit" onClick={(e) => clickLevel(l.price, 'BUY', e)}>
                    <td className="num mono amber">{mine ? fmtQty(mine, lot) : ''}</td>
                    <td className="num mono muted">{l.orders}</td>
                    <td className="num mono" style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', right: 0, top: 2, bottom: 2, width: `${(l.size / maxSize) * 100}%`, background: 'rgba(25,195,125,0.16)' }} />
                      <span style={{ position: 'relative' }}>{fmtCompact(l.size, lot < 1 ? 3 : 1)}</span>
                    </td>
                    <td className="num mono up b">{fmtPrice(l.price, inst)}</td>
                    <td className="num mono muted">{fmtCompact(l.cum, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '4px 8px', borderTop: '1px solid var(--line)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="mono up" style={{ fontSize: 10.5 }}>{fmtCompact(totalBid, 1)}</span>
          <div style={{ flex: 1, height: 6, background: 'var(--down)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(totalBid / (totalBid + totalAsk)) * 100}%`, background: 'var(--up)' }} />
          </div>
          <span className="mono down" style={{ fontSize: 10.5 }}>{fmtCompact(totalAsk, 1)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div className="section-title" style={{ paddingTop: 8 }}>Time &amp; Sales</div>
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table className="grid">
            <thead><tr><th>Time</th><th className="num">Price</th><th className="num">Size</th></tr></thead>
            <tbody>
              {(tape || []).map((t, i) => (
                <tr key={`${t.t}${i}`}>
                  <td className="mono muted">{fmtTime(t.t)}</td>
                  <td className={`num mono ${t.side === 'B' ? 'up' : 'down'}`}>{fmtPrice(t.p, inst)}</td>
                  <td className="num mono" style={{ fontWeight: t.s * t.p > 250_000 ? 700 : 400, color: t.s * t.p > 250_000 ? 'var(--amber)' : undefined }}>{fmtCompact(t.s, lot < 1 ? 3 : 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
