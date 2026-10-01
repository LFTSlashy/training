import { create } from 'zustand';
import { api } from '../lib/api';
import type { AccountSummary, Alert, Fill, Order, Position, Watchlist } from '../lib/types';

interface AccountState {
  summary: AccountSummary | null;
  positions: Position[];
  orders: Order[];
  fills: Fill[];
  alerts: Alert[];
  watchlists: Watchlist[];
  refresh: () => Promise<void>;
  refreshPositions: () => Promise<void>;
  refreshAlerts: () => Promise<void>;
  upsertOrder: (o: Order) => void;
  addFill: (f: Fill) => void;
  saveWatchlists: (lists: Watchlist[]) => Promise<void>;
}

let posTimer: ReturnType<typeof setTimeout> | null = null;

export const useAccount = create<AccountState>((set, get) => ({
  summary: null,
  positions: [],
  orders: [],
  fills: [],
  alerts: [],
  watchlists: [],
  refresh: async () => {
    const [summary, positions, orders, fills, alerts, watchlists] = await Promise.all([
      api.get<AccountSummary>('/account'),
      api.get<Position[]>('/account/positions'),
      api.get<Order[]>('/account/orders'),
      api.get<Fill[]>('/account/fills'),
      api.get<Alert[]>('/alerts'),
      api.get<Watchlist[]>('/watchlists'),
    ]);
    set({ summary, positions, orders, fills, alerts, watchlists });
  },
  refreshPositions: async () => {
    // Debounced: bursts of fills (book sweeps) trigger a single refresh.
    if (posTimer) return;
    posTimer = setTimeout(async () => {
      posTimer = null;
      try {
        set({ positions: await api.get<Position[]>('/account/positions') });
      } catch { /* ignore */ }
    }, 150);
  },
  refreshAlerts: async () => set({ alerts: await api.get<Alert[]>('/alerts') }),
  upsertOrder: (o) => {
    const orders = get().orders;
    const i = orders.findIndex((x) => x.id === o.id);
    if (i >= 0) {
      const next = orders.slice();
      next[i] = o;
      set({ orders: next });
    } else set({ orders: [o, ...orders].slice(0, 1000) });
  },
  addFill: (f) => set({ fills: [f, ...get().fills].slice(0, 1000) }),
  saveWatchlists: async (lists) => {
    set({ watchlists: lists });
    set({ watchlists: await api.put<Watchlist[]>('/watchlists', lists) });
  },
}));
