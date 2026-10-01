import type { PanelProps } from './registry';
import { useMarket } from '../store/market';
import { QuoteTable } from './QuoteTable';

export default function WorldIndices({ p, load }: PanelProps) {
  const list = useMarket((s) => s.list);
  const idx = list.filter((i) => i.type === 'index');
  const groups = ['Americas', 'EMEA', 'Asia/Pacific'].map((r) => ({ title: r, items: idx.filter((i) => i.region === r) }));
  const rates = { title: 'Government bond yields', items: list.filter((i) => i.type === 'rate') };
  return <QuoteTable groups={[...groups, rates]} selected={p.symbol} onSelect={(s) => load({ symbol: s })} />;
}
