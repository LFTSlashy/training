import { useMarket } from '../store/market';
import { FlashPrice } from '../components/common';
import { fmtCompact, fmtPrice, fmtChange, signClass, fmtNum } from '../lib/format';
import type { Instrument } from '../lib/types';

/** Grouped live quote table used by WEI, CRYP and CMDTY. */
export function QuoteTable({ groups, selected, onSelect, extra }: {
  groups: { title: string; items: Instrument[] }[];
  selected?: string;
  onSelect: (s: string) => void;
  extra?: { label: string; render: (i: Instrument) => React.ReactNode }[];
}) {
  const quotes = useMarket((s) => s.quotes);
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Security</th><th>Name</th><th className="num">Last</th><th className="num">Net</th><th className="num">%Chg</th>
          <th className="num">Open</th><th className="num">High</th><th className="num">Low</th>
          {extra?.map((e) => <th key={e.label} className="num">{e.label}</th>)}
          <th className="num">Time</th>
        </tr>
      </thead>
      <tbody>
        {groups.map((g) => [
          <tr key={`g${g.title}`} className="group"><td colSpan={9 + (extra?.length ?? 0)}>{g.title}</td></tr>,
          ...g.items.map((i) => {
            const q = quotes[i.symbol];
            if (!q) return null;
            return (
              <tr key={i.symbol} className={`clickable ${selected === i.symbol ? 'sel' : ''}`} onClick={() => onSelect(i.symbol)}>
                <td className="sym">{i.symbol}</td>
                <td className="name">{i.name}</td>
                <td className="num"><FlashPrice value={q.last} inst={i} /></td>
                <td className={`num mono ${signClass(q.change)}`}>{i.type === 'rate' ? fmtNum(q.change * 100, 1) : fmtPrice(q.change, i)}</td>
                <td className={`num mono ${signClass(q.changePct)}`}><span className={`pill ${signClass(q.changePct)}`}>{fmtChange(q.changePct, i)}</span></td>
                <td className="num mono dim">{fmtPrice(q.open, i)}</td>
                <td className="num mono dim">{fmtPrice(q.high, i)}</td>
                <td className="num mono dim">{fmtPrice(q.low, i)}</td>
                {extra?.map((e) => <td key={e.label} className="num mono dim">{e.render(i)}</td>)}
                <td className="num mono muted">{q.t ? new Date(q.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}

export const volCol = { label: 'Volume', render: (i: Instrument) => fmtCompact(useMarket.getState().quotes[i.symbol]?.volume, 1) };
