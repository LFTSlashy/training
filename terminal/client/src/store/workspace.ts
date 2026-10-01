import { create } from 'zustand';
import { api } from '../lib/api';

export type LinkColor = 'amber' | 'blue' | 'green' | 'purple' | null;
export type LayoutId = 'single' | 'split' | 'main3' | 'quad' | 'pro5' | 'six';

export interface PanelState {
  id: string;
  fn: string;
  symbol: string;
  link: LinkColor;
  params?: Record<string, unknown>;
}

export interface Page {
  id: string;
  name: string;
  layout: LayoutId;
  panels: PanelState[];
}

export const LAYOUTS: Record<LayoutId, { label: string; areas: string[]; cols: string; rows: string; count: number }> = {
  single: { label: '1', areas: ['a'], cols: '1fr', rows: '1fr', count: 1 },
  split: { label: '2', areas: ['a b'], cols: '1.4fr 1fr', rows: '1fr', count: 2 },
  main3: { label: '3', areas: ['a b', 'a c'], cols: '1.6fr 1fr', rows: '1fr 1fr', count: 3 },
  quad: { label: '4', areas: ['a b', 'c d'], cols: '1fr 1fr', rows: '1fr 1fr', count: 4 },
  pro5: { label: '5', areas: ['a a b', 'c d e'], cols: '1.25fr 1fr 1fr', rows: '1.15fr 1fr', count: 5 },
  six: { label: '6', areas: ['a b c', 'd e f'], cols: '1.55fr 1fr 1fr', rows: '1fr 1fr', count: 6 },
};

const p = (id: string, fn: string, symbol = 'AAPL', link: LinkColor = 'amber', params?: Record<string, unknown>): PanelState => ({ id, fn, symbol, link, params });

export const defaultPages = (): Page[] => [
  {
    id: 'trading', name: 'Trading', layout: 'six',
    panels: [p('t1', 'GP'), p('t2', 'DOM'), p('t3', 'MON', 'AAPL', 'amber'), p('t4', 'TRD'), p('t5', 'BLTR', 'AAPL', null), p('t6', 'N', 'AAPL', null)],
  },
  {
    id: 'markets', name: 'Markets', layout: 'quad',
    panels: [p('m1', 'WEI', 'SPX', 'blue'), p('m2', 'GP', 'SPX', 'blue'), p('m3', 'HMAP', 'SPX', null), p('m4', 'MOST', 'SPX', null), p('m5', 'FXC', 'EURUSD', null), p('m6', 'N', 'SPX', null)],
  },
  {
    id: 'portfolio', name: 'Portfolio', layout: 'quad',
    panels: [p('p1', 'PORT', 'AAPL', 'green'), p('p2', 'RISK', 'AAPL', null), p('p3', 'GP', 'AAPL', 'green'), p('p4', 'BLTR', 'AAPL', null), p('p5', 'ALRT', 'AAPL', null), p('p6', 'TRD', 'AAPL', 'green')],
  },
  {
    id: 'research', name: 'Research', layout: 'quad',
    panels: [p('r1', 'DES', 'NVDA', 'purple'), p('r2', 'GP', 'NVDA', 'purple'), p('r3', 'FA', 'NVDA', 'purple'), p('r4', 'N', 'NVDA', 'purple'), p('r5', 'EQS', 'NVDA', null), p('r6', 'CORR', 'NVDA', null)],
  },
  {
    id: 'macro', name: 'Macro', layout: 'six',
    panels: [p('x1', 'GC', 'USGG10YR', null), p('x2', 'ECO', 'SPX', null), p('x3', 'FXC', 'EURUSD', null), p('x4', 'CMDTY', 'CL1', 'blue'), p('x5', 'CRYP', 'BTCUSD', 'blue'), p('x6', 'GP', 'BTCUSD', 'blue')],
  },
];

interface WorkspaceState {
  pages: Page[];
  pageId: string;
  activePanel: string;
  maximized: string | null;
  page: () => Page;
  setPage: (id: string) => void;
  setLayout: (layout: LayoutId) => void;
  setActive: (panelId: string) => void;
  toggleMaximize: (panelId: string) => void;
  load: (panelId: string, change: { fn?: string; symbol?: string; params?: Record<string, unknown> }) => void;
  setLink: (panelId: string, link: LinkColor) => void;
  setParams: (panelId: string, params: Record<string, unknown>) => void;
  renamePage: (id: string, name: string) => void;
  resetPages: () => void;
  hydrate: (pages: Page[] | null) => void;
}

const LS_KEY = 'quanta.workspace.v1';
let syncTimer: ReturnType<typeof setTimeout> | null = null;

const persist = (state: Pick<WorkspaceState, 'pages' | 'pageId'>) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ pages: state.pages, pageId: state.pageId })); } catch { /* ignore */ }
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { api.put('/layout', { pages: state.pages, pageId: state.pageId }).catch(() => {}); }, 1500);
};

const loadLocal = (): { pages: Page[]; pageId: string } | null => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v.pages) && v.pages.length ? v : null;
  } catch {
    return null;
  }
};

const initial = loadLocal() ?? { pages: defaultPages(), pageId: 'trading' };

export const useWorkspace = create<WorkspaceState>((set, get) => {
  const updatePanels = (fn: (panels: PanelState[], page: Page) => PanelState[]) => {
    const pages = get().pages.map((pg) => (pg.id === get().pageId ? { ...pg, panels: fn(pg.panels, pg) } : pg));
    set({ pages });
    persist(get());
  };
  return {
    pages: initial.pages,
    pageId: initial.pageId,
    activePanel: initial.pages.find((x) => x.id === initial.pageId)?.panels[0]?.id ?? '',
    maximized: null,
    page: () => get().pages.find((x) => x.id === get().pageId) ?? get().pages[0],
    setPage: (id) => {
      const pg = get().pages.find((x) => x.id === id);
      if (!pg) return;
      set({ pageId: id, activePanel: pg.panels[0].id, maximized: null });
      persist(get());
    },
    setLayout: (layout) => {
      const pages = get().pages.map((pg) => (pg.id === get().pageId ? { ...pg, layout } : pg));
      set({ pages, maximized: null });
      persist(get());
    },
    setActive: (panelId) => get().activePanel !== panelId && set({ activePanel: panelId }),
    toggleMaximize: (panelId) => set({ maximized: get().maximized === panelId ? null : panelId }),
    load: (panelId, change) => updatePanels((panels) => {
      const target = panels.find((x) => x.id === panelId);
      if (!target) return panels;
      const symbolChanged = change.symbol && change.symbol !== target.symbol;
      return panels.map((x) => {
        if (x.id === panelId) return { ...x, ...change, params: change.params ?? (change.fn && change.fn !== x.fn ? undefined : x.params) };
        // Propagate security changes across panels sharing the same link colour.
        if (symbolChanged && target.link && x.link === target.link) return { ...x, symbol: change.symbol as string };
        return x;
      });
    }),
    setLink: (panelId, link) => updatePanels((panels) => panels.map((x) => (x.id === panelId ? { ...x, link } : x))),
    setParams: (panelId, params) => updatePanels((panels) => panels.map((x) => (x.id === panelId ? { ...x, params: { ...x.params, ...params } } : x))),
    renamePage: (id, name) => {
      set({ pages: get().pages.map((pg) => (pg.id === id ? { ...pg, name } : pg)) });
      persist(get());
    },
    resetPages: () => {
      set({ pages: defaultPages(), pageId: 'trading', activePanel: 't1', maximized: null });
      persist(get());
    },
    hydrate: (remote) => {
      if (!remote || !Array.isArray(remote) || !remote.length || loadLocal()) return;
      set({ pages: remote, pageId: remote[0].id, activePanel: remote[0].panels[0].id });
    },
  };
});
