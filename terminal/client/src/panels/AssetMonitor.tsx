import type { PanelProps } from './registry';
import { useMarket } from '../store/market';
import { QuoteTable, volCol } from './QuoteTable';
import { fmtCompact } from '../lib/format';

export function Crypto({ p, load }: PanelProps) {
  const list = useMarket((s) => s.list);
  const quotes = useMarket((s) => s.quotes);
  const items = list.filter((i) => i.type === 'crypto');
  const extra = [
    volCol,
    { label: 'Turnover $', render: (i: typeof items[number]) => fmtCompact((quotes[i.symbol]?.volume ?? 0) * (quotes[i.symbol]?.vwap ?? 0), 1) },
  ];
  return <QuoteTable groups={[{ title: 'Digital assets — 24/7', items }]} selected={p.symbol} onSelect={(s) => load({ symbol: s })} extra={extra} />;
}

export function Commodities({ p, load }: PanelProps) {
  const list = useMarket((s) => s.list);
  const items = list.filter((i) => i.type === 'commodity');
  const groups = ['Energy', 'Metals', 'Agriculture'].map((g) => ({ title: g, items: items.filter((i) => i.group === g) }));
  const extra = [{ label: 'Unit', render: (i: typeof items[number]) => i.unit }, volCol];
  return <QuoteTable groups={groups} selected={p.symbol} onSelect={(s) => load({ symbol: s })} extra={extra} />;
}
