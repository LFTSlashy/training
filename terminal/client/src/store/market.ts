import { create } from 'zustand';
import type { Book, Instrument, NewsItem, Print, Quote } from '../lib/types';

interface MarketState {
  instruments: Record<string, Instrument>;
  list: Instrument[];
  quotes: Record<string, Quote>;
  books: Record<string, Book>;
  tapes: Record<string, Print[]>;
  news: NewsItem[];
  status: 'connecting' | 'live' | 'offline';
  latency: number | null;
  lastTick: number;
  setInstruments: (list: Instrument[]) => void;
  mergeQuotes: (q: Record<string, Quote>, t?: number) => void;
}

export const useMarket = create<MarketState>((set, get) => ({
  instruments: {},
  list: [],
  quotes: {},
  books: {},
  tapes: {},
  news: [],
  status: 'connecting',
  latency: null,
  lastTick: 0,
  setInstruments: (list) => set({ list, instruments: Object.fromEntries(list.map((i) => [i.symbol, i])) }),
  mergeQuotes: (q, t) => set({ quotes: { ...get().quotes, ...q }, lastTick: t ?? Date.now() }),
}));

export const useQuote = (symbol: string | undefined | null) => useMarket((s) => (symbol ? s.quotes[symbol] : undefined));
export const useInstrument = (symbol: string | undefined | null) => useMarket((s) => (symbol ? s.instruments[symbol] : undefined));
