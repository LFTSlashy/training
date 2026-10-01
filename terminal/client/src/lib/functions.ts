export interface FnDef {
  code: string;
  name: string;
  security: boolean; // operates on a security
  category: 'Security' | 'Trading' | 'Markets' | 'Analytics' | 'News' | 'System';
  description: string;
}

export const FUNCTIONS: FnDef[] = [
  { code: 'GP', name: 'Price Graph', security: true, category: 'Security', description: 'Interactive candlestick chart with indicators (SMA/EMA/BB/VWAP/RSI/MACD)' },
  { code: 'DES', name: 'Description', security: true, category: 'Security', description: 'Security overview, key statistics, performance and betas' },
  { code: 'FA', name: 'Financial Analysis', security: true, category: 'Security', description: 'Quarterly financials, margins, analyst ratings, holders' },
  { code: 'DOM', name: 'Depth of Market', security: true, category: 'Trading', description: 'Level-2 order book ladder and time & sales' },
  { code: 'TRD', name: 'Order Ticket', security: true, category: 'Trading', description: 'Execute market, limit, stop and stop-limit orders' },
  { code: 'BLTR', name: 'Blotter', security: false, category: 'Trading', description: 'Working orders, order history and executions' },
  { code: 'PORT', name: 'Portfolio', security: false, category: 'Trading', description: 'Positions, P&L, equity curve and account summary' },
  { code: 'RISK', name: 'Portfolio Risk', security: false, category: 'Analytics', description: 'VaR, CVaR, stress scenarios, exposures and risk contribution' },
  { code: 'MON', name: 'Monitor', security: false, category: 'Markets', description: 'Customisable watchlists with live quotes and sparklines' },
  { code: 'WEI', name: 'World Equity Indices', security: false, category: 'Markets', description: 'Global equity index dashboard by region' },
  { code: 'FXC', name: 'FX Cross Rates', security: false, category: 'Markets', description: 'Cross-currency matrix with daily changes' },
  { code: 'CRYP', name: 'Crypto Monitor', security: false, category: 'Markets', description: 'Digital assets live prices and performance' },
  { code: 'CMDTY', name: 'Commodities', security: false, category: 'Markets', description: 'Energy, metals and agriculture futures' },
  { code: 'GC', name: 'Yield Curves', security: false, category: 'Markets', description: 'Sovereign yield curves and key spreads' },
  { code: 'MOST', name: 'Most Active', security: false, category: 'Markets', description: 'Top gainers, losers and most active by turnover' },
  { code: 'HMAP', name: 'Sector Heatmap', security: false, category: 'Markets', description: 'Equity market heatmap by sector, weighted by market cap' },
  { code: 'EQS', name: 'Equity Screener', security: false, category: 'Analytics', description: 'Multi-criteria screening across the universe' },
  { code: 'CORR', name: 'Correlation Matrix', security: false, category: 'Analytics', description: 'Cross-asset correlation of daily returns' },
  { code: 'N', name: 'News', security: false, category: 'News', description: 'Real-time newswire, filterable by security' },
  { code: 'ECO', name: 'Economic Calendar', security: false, category: 'News', description: 'Macro releases with survey, prior and actual' },
  { code: 'ALRT', name: 'Alerts', security: false, category: 'System', description: 'Price / change / volume alerts with live notifications' },
  { code: 'HELP', name: 'Help', security: false, category: 'System', description: 'Function directory and keyboard shortcuts' },
];

export const FN = Object.fromEntries(FUNCTIONS.map((f) => [f.code, f])) as Record<string, FnDef>;

export const ALIASES: Record<string, string> = {
  G: 'GP', CHART: 'GP', GIP: 'GP', BOOK: 'DOM', DEPTH: 'DOM', MKT: 'DOM', TICKET: 'TRD', TRADE: 'TRD', EMSX: 'TRD',
  ORD: 'BLTR', ORDERS: 'BLTR', PRTU: 'PORT', PORTFOLIO: 'PORT', VAR: 'RISK', W: 'MON', WATCH: 'MON', NEWS: 'N', TOP: 'N', CN: 'N',
  WB: 'GC', YCRV: 'GC', FX: 'FXC', XCRY: 'CRYP', CRYPTO: 'CRYP', GLCO: 'CMDTY', CMD: 'CMDTY', MOV: 'MOST', IMAP: 'HMAP', SCREEN: 'EQS',
  CAL: 'ECO', EVTS: 'ECO', ALERT: 'ALRT', '?': 'HELP', H: 'HELP', FIN: 'FA', ANR: 'FA',
};

export const resolveFn = (s: string): string | null => {
  const u = s.toUpperCase();
  if (FN[u]) return u;
  if (ALIASES[u]) return ALIASES[u];
  return null;
};
