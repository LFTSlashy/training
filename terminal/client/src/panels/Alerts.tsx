import { useState } from 'react';
import type { PanelProps } from './registry';
import { useAccount } from '../store/account';
import { useMarket } from '../store/market';
import { api } from '../lib/api';
import { toast } from '../store/toasts';
import { fmtDateTime, fmtPrice } from '../lib/format';
import { Empty } from '../components/common';

export default function Alerts({ p }: PanelProps) {
  const alerts = useAccount((s) => s.alerts);
  const refresh = useAccount((s) => s.refreshAlerts);
  const quotes = useMarket((s) => s.quotes);
  const instruments = useMarket((s) => s.instruments);
  const [symbol, setSymbol] = useState(p.symbol);
  const [field, setField] = useState<'last' | 'changePct' | 'volume'>('last');
  const [op, setOp] = useState<'>=' | '<='>('>=');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const create = async () => {
    try {
      await api.post('/alerts', { symbol: symbol.toUpperCase(), field, op, value: Number(value), note });
      setValue('');
      setNote('');
      await refresh();
      toast({ kind: 'success', title: `Alert armed on ${symbol.toUpperCase()}` });
    } catch (e) {
      toast({ kind: 'error', title: 'Alert', body: (e as Error).message });
    }
  };
  const remove = async (id: string) => { await api.del(`/alerts/${id}`); refresh(); };
  const rearm = async (id: string) => { await api.post(`/alerts/${id}/rearm`); refresh(); };
  const q = quotes[symbol.toUpperCase()];

  return (
    <div>
      <div className="toolbar" style={{ alignItems: 'flex-end', gap: 6, padding: 8 }}>
        <div className="field" style={{ width: 90 }}><label>Security</label><input className="input" style={{ textTransform: 'uppercase' }} value={symbol} onChange={(e) => setSymbol(e.target.value)} /></div>
        <div className="field" style={{ width: 100 }}><label>Field</label>
          <select className="input" value={field} onChange={(e) => setField(e.target.value as typeof field)}><option value="last">Last price</option><option value="changePct">% change</option><option value="volume">Volume</option></select>
        </div>
        <div className="field" style={{ width: 60 }}><label>When</label>
          <select className="input" value={op} onChange={(e) => setOp(e.target.value as typeof op)}><option>{'>='}</option><option>{'<='}</option></select>
        </div>
        <div className="field" style={{ width: 100 }}><label>Value</label><input className="input" value={value} placeholder={q ? String(field === 'last' ? q.last : field === 'changePct' ? q.changePct.toFixed(2) : q.volume) : ''} onChange={(e) => setValue(e.target.value)} /></div>
        <div className="field" style={{ flex: 1, minWidth: 100 }}><label>Note</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} /></div>
        <button className="btn primary" disabled={!value} onClick={create}>Arm alert</button>
      </div>
      {!alerts.length ? <Empty>No alerts. Alerts are evaluated server-side on every tick and pushed in real time.</Empty> : (
        <table className="grid">
          <thead><tr><th>Security</th><th>Condition</th><th className="num">Current</th><th>Note</th><th>Created</th><th>Status</th><th /></tr></thead>
          <tbody>
            {[...alerts].reverse().map((a) => {
              const inst = instruments[a.symbol];
              const cur = quotes[a.symbol]?.[a.field];
              return (
                <tr key={a.id}>
                  <td className="sym">{a.symbol}</td>
                  <td className="mono">{a.field} {a.op} {a.field === 'last' ? fmtPrice(a.value, inst) : a.value}</td>
                  <td className="num mono">{a.field === 'last' ? fmtPrice(cur, inst) : cur?.toFixed(2)}</td>
                  <td className="dim">{a.note}</td>
                  <td className="mono muted">{fmtDateTime(a.createdAt)}</td>
                  <td>{a.active ? <span className="pill blue">ARMED</span> : <span className="pill amber" title={`at ${a.triggerValue}`}>TRIGGERED {a.triggeredAt ? fmtDateTime(a.triggeredAt) : ''}</span>}</td>
                  <td style={{ display: 'flex', gap: 4, alignItems: 'center', height: 'var(--row)' }}>
                    {!a.active && <button className="btn sm" onClick={() => rearm(a.id)}>Re-arm</button>}
                    <button className="btn sm danger" onClick={() => remove(a.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
