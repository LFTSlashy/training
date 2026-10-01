import { tokenStore } from './api';
import type { AccountSummary, Alert, Book, Fill, NewsItem, Order, Print, Quote } from './types';
import { useMarket } from '../store/market';
import { useAccount } from '../store/account';
import { toast } from '../store/toasts';
import { fmtPrice, fmtQty } from './format';

type Channel = 'book' | 'tape';

/** Real-time market/account feed over WebSocket with automatic reconnection. */
class Feed {
  private ws: WebSocket | null = null;
  private fields: string[] = [];
  private retry = 0;
  private closed = true;
  private subs: Record<Channel, Map<string, number>> = { book: new Map(), tape: new Map() };
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pingSent = 0;
  private announced = new Set<string>();

  connect() {
    this.closed = false;
    const token = tokenStore.get();
    if (!token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`);
    this.ws = ws;
    useMarket.setState({ status: 'connecting' });

    ws.onopen = () => {
      this.retry = 0;
      for (const ch of ['book', 'tape'] as Channel[]) for (const s of this.subs[ch].keys()) this.send({ type: 'sub', channel: ch, symbol: s });
      this.pingTimer = setInterval(() => { this.pingSent = performance.now(); this.send({ type: 'ping' }); }, 5000);
    };
    ws.onmessage = (ev) => this.handle(JSON.parse(ev.data));
    ws.onclose = (ev) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.ws = null;
      useMarket.setState({ status: 'offline' });
      if (ev.code === 4401) {
        tokenStore.set(null);
        location.reload();
        return;
      }
      if (!this.closed) {
        const delay = Math.min(10_000, 500 * 2 ** this.retry++);
        setTimeout(() => !this.closed && this.connect(), delay);
      }
    };
  }

  disconnect() {
    this.closed = true;
    this.ws?.close();
  }

  private send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  subscribe(channel: Channel, symbol: string): () => void {
    const m = this.subs[channel];
    const n = m.get(symbol) || 0;
    m.set(symbol, n + 1);
    if (n === 0) this.send({ type: 'sub', channel, symbol });
    return () => {
      const c = (m.get(symbol) || 1) - 1;
      if (c <= 0) {
        m.delete(symbol);
        this.send({ type: 'unsub', channel, symbol });
      } else m.set(symbol, c);
    };
  }

  private expand(compact: Record<string, unknown[]>): Record<string, Quote> {
    const out: Record<string, Quote> = {};
    for (const [s, arr] of Object.entries(compact)) {
      const q: Record<string, unknown> = { symbol: s };
      this.fields.forEach((f, i) => { q[f] = arr[i]; });
      out[s] = q as unknown as Quote;
    }
    return out;
  }

  private handle(msg: { type: string; [k: string]: unknown }) {
    const market = useMarket.getState();
    const account = useAccount.getState();
    switch (msg.type) {
      case 'hello':
        this.fields = msg.fields as string[];
        market.mergeQuotes(this.expand(msg.quotes as Record<string, unknown[]>));
        useMarket.setState({ status: 'live' });
        useAccount.setState({ summary: msg.account as AccountSummary });
        break;
      case 'quotes':
        market.mergeQuotes(this.expand(msg.q as Record<string, unknown[]>), msg.t as number);
        break;
      case 'book': {
        const b = msg.data as Book;
        useMarket.setState({ books: { ...useMarket.getState().books, [b.symbol]: b } });
        break;
      }
      case 'tape': {
        const s = msg.symbol as string;
        const data = msg.data as Print[];
        const prev = useMarket.getState().tapes[s] || [];
        let next = data;
        if (msg.incremental && prev.length) {
          const newest = prev[0]?.t ?? 0;
          next = [...data.filter((p) => p.t > newest), ...prev].slice(0, 80);
        }
        useMarket.setState({ tapes: { ...useMarket.getState().tapes, [s]: next } });
        break;
      }
      case 'news': {
        const item = msg.data as NewsItem;
        useMarket.setState({ news: [item, ...useMarket.getState().news].slice(0, 400) });
        if (item.urgent) toast({ kind: 'warn', title: `★ ${item.tickers.slice(0, 3).join(' ')}`, body: item.headline }, 7000);
        break;
      }
      case 'account':
        useAccount.setState({ summary: msg.data as AccountSummary });
        break;
      case 'order': {
        const o = msg.data as Order;
        account.upsertOrder(o);
        if (o.status === 'CANCELLED' || o.status === 'EXPIRED' || o.status === 'REJECTED') {
          toast({ kind: 'info', title: `${o.status} ${o.side} ${o.symbol}`, body: o.reason || undefined });
        } else if (o.status === 'FILLED' && !this.announced.has(o.id)) {
          // One notification per completed order (a market order sweeping the book produces several fills).
          this.announced.add(o.id);
          const inst = useMarket.getState().instruments[o.symbol];
          toast({ kind: 'fill', title: `FILLED ${o.side} ${fmtQty(o.qty, inst?.lot)} ${o.symbol}`, body: `avg ${fmtPrice(o.avgFillPrice, inst)} · ${o.type.replace('_', ' ')} · ${o.id}` }, 4500);
        }
        break;
      }
      case 'fill': {
        const f = msg.data as Fill;
        account.addFill(f);
        account.refreshPositions();
        break;
      }
      case 'alert': {
        const a = msg.data as Alert;
        account.refreshAlerts();
        toast({ kind: 'alert', title: `ALERT ${a.symbol}`, body: `${a.field} ${a.op} ${a.value} (now ${a.triggerValue?.toFixed(4).replace(/\.?0+$/, '')})${a.note ? ` — ${a.note}` : ''}` }, 10000);
        break;
      }
      case 'pong':
        useMarket.setState({ latency: Math.round(performance.now() - this.pingSent) });
        break;
    }
  }
}

export const feed = new Feed();
