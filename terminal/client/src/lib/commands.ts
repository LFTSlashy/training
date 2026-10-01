import { api } from './api';
import { FN, resolveFn } from './functions';
import { useMarket } from '../store/market';
import { useWorkspace, LAYOUTS, type LayoutId } from '../store/workspace';
import { toast } from '../store/toasts';
import type { Order } from './types';

export interface CommandResult { ok: boolean; message?: string }

/**
 * Executes a terminal command. Grammar (case-insensitive):
 *   <SECURITY>                 load security into the active panel
 *   <FUNCTION>                 load function into the active panel
 *   <SECURITY> <FUNCTION>      both (e.g. "AAPL GP", "EURUSD DOM")
 *   BUY|SELL <SEC> <QTY> [@ <LIMIT>] [STP <STOP>]   quick order
 *   LAYOUT <1-6>               change panel layout
 *   PAGE <n|name>              switch workspace page
 */
export async function runCommand(raw: string): Promise<CommandResult> {
  const tokens = raw.trim().toUpperCase().replace(/<GO>$/, '').split(/\s+/).filter(Boolean);
  if (!tokens.length) return { ok: false };
  const { instruments } = useMarket.getState();
  const ws = useWorkspace.getState();
  const active = ws.page().panels.find((p) => p.id === ws.activePanel) ?? ws.page().panels[0];

  if (tokens[0] === 'BUY' || tokens[0] === 'SELL') return quickOrder(tokens);

  if (tokens[0] === 'LAYOUT' && tokens[1]) {
    const id = (Object.keys(LAYOUTS) as LayoutId[]).find((k) => LAYOUTS[k].label === tokens[1] || k.toUpperCase() === tokens[1]);
    if (!id) return { ok: false, message: 'Layout must be 1–6' };
    ws.setLayout(id);
    return { ok: true };
  }
  if (tokens[0] === 'PAGE' && tokens[1]) {
    const pages = ws.pages;
    const pg = pages[Number(tokens[1]) - 1] ?? pages.find((p) => p.name.toUpperCase() === tokens[1]);
    if (!pg) return { ok: false, message: 'Unknown page' };
    ws.setPage(pg.id);
    return { ok: true };
  }

  let symbol: string | undefined;
  let fn: string | undefined;
  for (const t of tokens) {
    if (!symbol && instruments[t]) symbol = t;
    else if (!fn && resolveFn(t)) fn = resolveFn(t) as string;
  }
  if (!symbol && !fn) {
    // try "BRK B" style names / partial symbol
    const joined = tokens.join('.');
    if (instruments[joined]) symbol = joined;
  }
  if (!symbol && !fn) return { ok: false, message: `Unknown security or function: ${tokens.join(' ')}` };

  const change: { fn?: string; symbol?: string } = {};
  if (symbol) change.symbol = symbol;
  if (fn) change.fn = fn;
  else if (symbol && FN[active.fn] && !FN[active.fn].security) change.fn = 'GP';
  ws.load(active.id, change);
  return { ok: true };
}

async function quickOrder(tokens: string[]): Promise<CommandResult> {
  const [side, symbol, qtyStr, ...rest] = tokens;
  const { instruments } = useMarket.getState();
  if (!symbol || !instruments[symbol]) return { ok: false, message: 'Usage: BUY|SELL <SECURITY> <QTY> [@ LIMIT] [STP STOP]' };
  const qty = Number(qtyStr?.replace(/,/g, '').replace(/K$/, '000').replace(/M$/, '000000'));
  if (!qty) return { ok: false, message: 'Quantity required' };
  let limitPrice: number | undefined, stopPrice: number | undefined;
  for (let i = 0; i < rest.length; i++) {
    if ((rest[i] === '@' || rest[i] === 'LMT' || rest[i] === 'AT') && rest[i + 1]) limitPrice = Number(rest[++i]);
    else if ((rest[i] === 'STP' || rest[i] === 'STOP') && rest[i + 1]) stopPrice = Number(rest[++i]);
    else if (rest[i].startsWith('@')) limitPrice = Number(rest[i].slice(1));
  }
  const type = limitPrice && stopPrice ? 'STP_LMT' : limitPrice ? 'LMT' : stopPrice ? 'STP' : 'MKT';
  try {
    const o = await api.post<Order>('/orders', { symbol, side, qty, type, limitPrice, stopPrice, tif: type === 'MKT' ? 'IOC' : 'DAY' });
    if (o.status !== 'FILLED') toast({ kind: 'success', title: `${side} ${qty} ${symbol} ${type}`, body: `Order ${o.id} — ${o.status.replace('_', ' ')}` });
    return { ok: true };
  } catch (e) {
    toast({ kind: 'error', title: 'Order rejected', body: (e as Error).message });
    return { ok: false, message: (e as Error).message };
  }
}
