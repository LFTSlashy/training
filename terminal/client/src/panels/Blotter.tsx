import { useState } from 'react';
import type { PanelProps } from './registry';
import { useAccount } from '../store/account';
import { useMarket } from '../store/market';
import { api } from '../lib/api';
import { toast } from '../store/toasts';
import { fmtDateTime, fmtPrice, fmtQty, fmtUsd, signClass } from '../lib/format';
import { Seg, Empty } from '../components/common';
import type { Order } from '../lib/types';
import { useWorkspace } from '../store/workspace';

const OPEN = ['WORKING', 'PARTIAL', 'PENDING_TRIGGER'];
const statusPill = (s: string) => ({ FILLED: 'up', PARTIAL: 'amber', WORKING: 'blue', PENDING_TRIGGER: 'amber', CANCELLED: 'gray', EXPIRED: 'gray', REJECTED: 'down' }[s] || 'gray');

export default function Blotter({ p, setParams }: PanelProps) {
  const tab = ((p.params?.tab as string) || 'working') as 'working' | 'orders' | 'fills';
  const orders = useAccount((s) => s.orders);
  const fills = useAccount((s) => s.fills);
  const instruments = useMarket((s) => s.instruments);
  const quotes = useMarket((s) => s.quotes);
  const ws = useWorkspaceLoad();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPx, setEditPx] = useState('');

  const working = orders.filter((o) => OPEN.includes(o.status));
  const list = tab === 'working' ? working : orders;

  const cancel = async (o: Order) => {
    try { await api.del(`/orders/${o.id}`); } catch (e) { toast({ kind: 'error', title: 'Cancel failed', body: (e as Error).message }); }
  };
  const amend = async (o: Order) => {
    try {
      await api.patch(`/orders/${o.id}`, o.status === 'PENDING_TRIGGER' ? { stopPrice: Number(editPx) } : { limitPrice: Number(editPx) });
      setEditing(null);
    } catch (e) { toast({ kind: 'error', title: 'Amend failed', body: (e as Error).message }); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        <Seg value={tab} options={[['working', `Working (${working.length})`], ['orders', 'All orders'], ['fills', `Executions (${fills.length})`]]} onChange={(v) => setParams({ tab: v })} />
        <span className="spacer" />
        {tab === 'working' && working.length > 0 && <button className="btn sm danger" onClick={() => api.post('/orders/cancel-all')}>Cancel all</button>}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        {tab !== 'fills' ? (
          list.length === 0 ? <Empty>{tab === 'working' ? 'No working orders.' : 'No orders yet.'}<br /><span className="mono">Try: BUY AAPL 100 @ 200</span></Empty> : (
            <table className="grid">
              <thead><tr><th>Time</th><th>Security</th><th>Side</th><th>Type</th><th className="num">Qty</th><th className="num">Filled</th><th className="num">Limit</th><th className="num">Stop</th><th className="num">Avg Px</th><th className="num">Mkt</th><th>TIF</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((o) => {
                  const inst = instruments[o.symbol];
                  const isOpen = OPEN.includes(o.status);
                  return (
                    <tr key={o.id} className="clickable" onClick={() => ws(o.symbol)} title={o.reason || o.id}>
                      <td className="mono muted">{fmtDateTime(o.createdAt)}</td>
                      <td className="sym">{o.symbol}</td>
                      <td className={o.side === 'BUY' ? 'up b' : 'down b'}>{o.side}</td>
                      <td className="mono">{o.type.replace('_', ' ')}</td>
                      <td className="num mono">{fmtQty(o.qty, inst?.lot)}</td>
                      <td className="num mono">{fmtQty(o.filledQty, inst?.lot)}</td>
                      <td className="num mono" onClick={(e) => { if (isOpen && o.limitPrice !== null) { e.stopPropagation(); setEditing(o.id); setEditPx(String(o.limitPrice)); } }}>
                        {editing === o.id && o.status !== 'PENDING_TRIGGER' ? (
                          <input className="input" style={{ height: 20, width: 90 }} autoFocus value={editPx} onChange={(e) => setEditPx(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') amend(o); if (e.key === 'Escape') setEditing(null); }} onBlur={() => setEditing(null)} onClick={(e) => e.stopPropagation()} />
                        ) : <span style={{ borderBottom: isOpen && o.limitPrice !== null ? '1px dashed var(--muted)' : undefined }}>{fmtPrice(o.limitPrice, inst)}</span>}
                      </td>
                      <td className="num mono" onClick={(e) => { if (o.status === 'PENDING_TRIGGER') { e.stopPropagation(); setEditing(o.id); setEditPx(String(o.stopPrice)); } }}>
                        {editing === o.id && o.status === 'PENDING_TRIGGER' ? (
                          <input className="input" style={{ height: 20, width: 90 }} autoFocus value={editPx} onChange={(e) => setEditPx(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') amend(o); if (e.key === 'Escape') setEditing(null); }} onBlur={() => setEditing(null)} onClick={(e) => e.stopPropagation()} />
                        ) : fmtPrice(o.stopPrice, inst)}
                      </td>
                      <td className="num mono">{fmtPrice(o.avgFillPrice, inst)}</td>
                      <td className="num mono muted">{fmtPrice(quotes[o.symbol]?.last, inst)}</td>
                      <td className="mono muted">{o.tif}</td>
                      <td><span className={`pill ${statusPill(o.status)}`}>{o.status.replace('_', ' ')}</span></td>
                      <td>{isOpen && <button className="btn sm danger" onClick={(e) => { e.stopPropagation(); cancel(o); }}>Cancel</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : fills.length === 0 ? <Empty>No executions yet.</Empty> : (
          <table className="grid">
            <thead><tr><th>Time</th><th>Security</th><th>Side</th><th className="num">Qty</th><th className="num">Price</th><th className="num">Notional $</th><th className="num">Comm $</th><th className="num">Realized $</th><th>Liq</th><th>Order</th></tr></thead>
            <tbody>
              {fills.map((f) => {
                const inst = instruments[f.symbol];
                return (
                  <tr key={f.id} className="clickable" onClick={() => ws(f.symbol)}>
                    <td className="mono muted">{fmtDateTime(f.t)}</td>
                    <td className="sym">{f.symbol}</td>
                    <td className={f.side === 'BUY' ? 'up b' : 'down b'}>{f.side}</td>
                    <td className="num mono">{fmtQty(f.qty, inst?.lot)}</td>
                    <td className="num mono">{fmtPrice(f.price, inst)}</td>
                    <td className="num mono">{fmtUsd(f.notionalUsd)}</td>
                    <td className="num mono muted">{f.commission.toFixed(2)}</td>
                    <td className={`num mono ${signClass(f.realized)}`}>{f.realized ? fmtUsd(f.realized, 2) : ''}</td>
                    <td className="mono muted">{f.liquidity}</td>
                    <td className="mono muted">{f.orderId}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/** Loads a security into the linked panels of the active page (blotter rows are clickable). */
function useWorkspaceLoad() {
  return (symbol: string) => {
    const ws = useWorkspace.getState();
    const pg = ws.page();
    const linked = pg.panels.find((x) => x.link && ['GP', 'DOM', 'TRD', 'DES'].includes(x.fn));
    if (linked) ws.load(linked.id, { symbol });
  };
}
