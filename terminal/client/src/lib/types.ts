export type AssetType = 'index' | 'equity' | 'etf' | 'fx' | 'crypto' | 'commodity' | 'rate';

export interface Instrument {
  symbol: string;
  name: string;
  type: AssetType;
  assetClass: string;
  exchange?: string;
  currency: string;
  base?: string;
  region?: string;
  sector?: string;
  industry?: string;
  group?: string;
  tick: number;
  decimals: number;
  lot: number;
  multiplier: number;
  tradable: boolean;
  unit?: string;
  tenor?: number;
  country?: string;
}

export interface Quote {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  dir: number;
  bidSize: number;
  askSize: number;
  vwap: number;
  t?: number;
}

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number }

export interface BookLevel { price: number; size: number; orders: number }
export interface Book { symbol: string; bids: BookLevel[]; asks: BookLevel[]; mid: number; spread: number; t: number }
export interface Print { t: number; p: number; s: number; side: 'B' | 'S' }

export interface NewsItem {
  id: string;
  t: number;
  headline: string;
  body: string;
  category: string;
  sentiment: number;
  tickers: string[];
  source: string;
  urgent: boolean;
  macro: boolean;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MKT' | 'LMT' | 'STP' | 'STP_LMT';
export type Tif = 'DAY' | 'GTC' | 'IOC' | 'FOK';
export type OrderStatus = 'WORKING' | 'PARTIAL' | 'PENDING_TRIGGER' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  tif: Tif;
  qty: number;
  filledQty: number;
  avgFillPrice: number | null;
  limitPrice: number | null;
  stopPrice: number | null;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  reason: string | null;
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  qty: number;
  price: number;
  commission: number;
  realized: number;
  notionalUsd: number;
  t: number;
  liquidity: string;
}

export interface Position {
  symbol: string;
  name: string;
  type: AssetType;
  sector: string | null;
  currency: string;
  qty: number;
  avgPrice: number;
  last: number;
  changePct: number;
  marketValue: number;
  costBasis: number;
  unrealized: number;
  unrealizedPct: number;
  dayPnl: number;
  realized: number;
  openedAt: number;
}

export interface AccountSummary {
  currency: string;
  cash: number;
  equity: number;
  longValue: number;
  shortValue: number;
  grossExposure: number;
  netExposure: number;
  leverage: number;
  buyingPower: number;
  maxLeverage: number;
  marginUsed: number;
  unrealized: number;
  realized: number;
  commissions: number;
  dayPnl: number;
  dayPnlPct: number;
  totalPnl: number;
  totalPnlPct: number;
  positionCount: number;
  workingOrders: number;
  startingCash: number;
}

export interface Alert {
  id: string;
  symbol: string;
  op: '>=' | '<=';
  field: 'last' | 'changePct' | 'volume';
  value: number;
  note: string;
  active: boolean;
  createdAt: number;
  triggeredAt: number | null;
  triggerValue: number | null;
}

export interface Watchlist { id: string; name: string; symbols: string[] }

export interface User { id: string; username: string; displayName: string; createdAt: number }
