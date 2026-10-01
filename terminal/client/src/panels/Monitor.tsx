import { useEffect, useMemo, useState } from 'react';
import type { PanelProps } from './registry';
import { useAccount } from '../store/account';
import { useMarket } from '../store/market';
import { api } from '../lib/api';
import { useSort } from '../lib/hooks';
import { fmtCompact, fmtPrice, fmtChange, signClass, fmtNum } from '../lib/format';
import { FlashPrice, Sparkline, Th, Empty } from '../components/common';
import { toast } from '../store/toasts';

interface Row { symbol: string; name: string; last: number; bid: number; ask: number; change: number; changePct: number; volume: number; high: number; low: number; range: number }

export default function Monitor({ p, load, setParams }: PanelProps) {
  const lists = useAccount((s) => s.watchlists);
  const save = useAccount((s) => s.saveWatchlists);
  const quotes = useMarket((s) => s.quotes);
  const instruments = useMarket((s) => s.instruments);
  const listId = (p.params?.list as string) || lists[0]?.id;
  const list = lists.find((l) => l.id === listId) ?? lists[0];
  const [adding, setAdding] = useState('');
  const [sparks, setSparks] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (!list?.symbols.length) return;
    const fetchSparks = () => api.get<Record<string, number[]>>(`/sparks?symbols=${list.symbols.join(',')}&n=90`).then(setSparks).catch(() => {});
    fetchSparks();
    const id = setInterval(fetchSparks, 30_000);
    return () => clearInterval(id);
  }, [list?.symbols.join(',')]);

  const rows = useMemo<Row[]>(() => (list?.symbols || []).filter((s) => quotes[s]).map((s) => {
    const q = quotes[s];
    return { symbol: s, name: instruments[s]?.name ?? s, last: q.last, bid: q.bid, ask: q.ask, change: q.change, changePct: q.changePct, volume: q.volume, high: q.high, low: q.low, range: q.high > q.low ? (q.last - q.low) / (q.high - q.low) : 0.5 };
  }), [list, quotes, instruments]);
  const sort = useSort<Row>(rows, null);

  if (!list) return <Empty>No watchlists.</Empty>;

  const add = async () => {
    const sym = adding.trim().toUpperCase();
    if (!sym) return;
    if (!instruments[sym]) { toast({ kind: 'error', title: `Unknown security ${sym}` }); return; }
    await save(lists.map((l) => (l.id === list.id ? { ...l, symbols: [...new Set([...l.symbols, sym])] } : l)));
    setAdding('');
  };
  const remove = (sym: string) => save(lists.map((l) => (l.id === list.id ? { ...l, symbols: l.symbols.filter((s) => s !== sym) } : l)));
  const newList = () => {
    const name = prompt('New watchlist name');
    if (!name) return;
    const id = `wl${Date.now().toString(36)}`;
    save([...lists, { id, name, symbols: [] }]).then(() => setParams({ list: id }));
  };
  const deleteList = () => {
    if (lists.length <= 1 || !confirm(`Delete watchlist "${list.name}"?`)) return;
    save(lists.filter((l) => l.id !== list.id)).then(() => setParams({ list: undefined }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="toolbar">
        {lists.map((l) => <span key={l.id} className={`chip ${l.id === list.id ? 'on' : ''}`} onClick={() => setParams({ list: l.id })}>{l.name}</span>)}
        <span className="chip" onClick={newList} title="New watchlist">＋</span>
        <span className="spacer" />
        <input className="input" style={{ width: 110, height: 22, textTransform: 'uppercase' }} placeholder="Add ticker" value={adding} onChange={(e) => setAdding(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        {lists.length > 1 && <button className="icon-btn" title="Delete list" onClick={deleteList}>🗑</button>}
      </div>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="grid">
          <thead>
            <tr>
              <Th k="symbol" label="Security" sort={sort} />
              <Th k="last" label="Last" sort={sort} num />
              <Th k="change" label="Net" sort={sort} num />
              <Th k="changePct" label="%Chg" sort={sort} num />
              <th>Intraday</th>
              <Th k="range" label="Day range" sort={sort} />
              <Th k="bid" label="Bid" sort={sort} num />
              <Th k="ask" label="Ask" sort={sort} num />
              <Th k="volume" label="Volume" sort={sort} num />
              <th />
            </tr>
          </thead>
          <tbody>
            {sort.sorted.map((r) => {
              const inst = instruments[r.symbol];
              const live = sparks[r.symbol] ? [...sparks[r.symbol].slice(-89), r.last] : [];
              return (
                <tr key={r.symbol} className={`clickable ${r.symbol === p.symbol ? 'sel' : ''}`} onClick={() => load({ symbol: r.symbol })}>
                  <td className="sym" title={r.name}>{r.symbol}</td>
                  <td className="num"><FlashPrice value={r.last} inst={inst} /></td>
                  <td className={`num mono ${signClass(r.change)}`}>{inst?.type === 'rate' ? fmtNum(r.change * 100, 1) : fmtPrice(r.change, inst)}</td>
                  <td className={`num mono ${signClass(r.changePct)}`}>{fmtChange(r.changePct, inst)}</td>
                  <td><Sparkline data={live} width={70} height={16} /></td>
                  <td>
                    <div style={{ width: 70, height: 4, background: 'var(--bg-4)', borderRadius: 2, position: 'relative' }} title={`${fmtPrice(r.low, inst)} – ${fmtPrice(r.high, inst)}`}>
                      <div style={{ position: 'absolute', left: `calc(${r.range * 100}% - 3px)`, top: -2, width: 6, height: 8, borderRadius: 2, background: 'var(--amber)' }} />
                    </div>
                  </td>
                  <td className="num mono dim">{fmtPrice(r.bid, inst)}</td>
                  <td className="num mono dim">{fmtPrice(r.ask, inst)}</td>
                  <td className="num mono muted">{r.volume ? fmtCompact(r.volume, 1) : ''}</td>
                  <td><button className="icon-btn" title="Remove" onClick={(e) => { e.stopPropagation(); remove(r.symbol); }}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <Empty>Empty list — add tickers above.</Empty>}
      </div>
    </div>
  );
}
