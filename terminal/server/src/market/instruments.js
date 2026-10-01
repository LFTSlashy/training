// Instrument universe. Prices are approximate reference levels used to seed the simulation.
// factors: exposures to common factors (see FACTOR_VOLS) — they produce realistic cross-asset correlations.

export const FACTOR_VOLS = {
  EQ: 0.16, // global equity
  US: 0.05, EU: 0.08, ASIA: 0.10,
  TECH: 0.14, FIN: 0.10, ENERGY: 0.18, HEALTH: 0.08, CONS: 0.07, IND: 0.08, COMM: 0.09,
  CRYPTO: 0.55,
  USD: 0.07, // dollar index factor (positive => USD stronger)
  OIL: 0.30, METAL: 0.14, AGS: 0.18,
  RATES: 0.85, // absolute yield vol (percentage points per year)
  VOL: 1.2,
};

const eq = (symbol, name, exchange, currency, sector, industry, price, vol, factors, extra) => ({
  symbol, name, type: 'equity', exchange, currency, sector, industry, price, vol, factors,
  tick: 0.01, decimals: 2, multiplier: 1, lot: 1, spreadBps: 2, tradable: true, ...extra,
});

const US_TECH = [{ f: 'EQ', b: 1.15 }, { f: 'US', b: 1 }, { f: 'TECH', b: 1 }];
const US_FIN = [{ f: 'EQ', b: 1.1 }, { f: 'US', b: 1 }, { f: 'FIN', b: 1 }];
const US_ENERGY = [{ f: 'EQ', b: 0.8 }, { f: 'US', b: 1 }, { f: 'ENERGY', b: 1 }, { f: 'OIL', b: 0.35 }];
const US_HEALTH = [{ f: 'EQ', b: 0.7 }, { f: 'US', b: 1 }, { f: 'HEALTH', b: 1 }];
const US_CONS = [{ f: 'EQ', b: 0.8 }, { f: 'US', b: 1 }, { f: 'CONS', b: 1 }];
const US_IND = [{ f: 'EQ', b: 1.0 }, { f: 'US', b: 1 }, { f: 'IND', b: 1 }];
const US_COMM = [{ f: 'EQ', b: 1.0 }, { f: 'US', b: 1 }, { f: 'COMM', b: 1 }, { f: 'TECH', b: 0.4 }];

export const INSTRUMENTS = [
  // ── Equity indices ────────────────────────────────────────────────
  { symbol: 'SPX', name: 'S&P 500 Index', type: 'index', exchange: 'CBOE', currency: 'USD', region: 'Americas', price: 5762, vol: 0.15, factors: [{ f: 'EQ', b: 1 }, { f: 'US', b: 1 }, { f: 'TECH', b: 0.3 }] },
  { symbol: 'NDX', name: 'Nasdaq 100 Index', type: 'index', exchange: 'NASDAQ', currency: 'USD', region: 'Americas', price: 20060, vol: 0.20, factors: [{ f: 'EQ', b: 1.15 }, { f: 'US', b: 1 }, { f: 'TECH', b: 0.8 }] },
  { symbol: 'INDU', name: 'Dow Jones Industrial Average', type: 'index', exchange: 'NYSE', currency: 'USD', region: 'Americas', price: 42330, vol: 0.13, factors: [{ f: 'EQ', b: 0.9 }, { f: 'US', b: 1 }, { f: 'IND', b: 0.4 }] },
  { symbol: 'RTY', name: 'Russell 2000 Index', type: 'index', exchange: 'CBOE', currency: 'USD', region: 'Americas', price: 2230, vol: 0.21, factors: [{ f: 'EQ', b: 1.2 }, { f: 'US', b: 1.3 }, { f: 'FIN', b: 0.4 }] },
  { symbol: 'SPTSX', name: 'S&P/TSX Composite', type: 'index', exchange: 'TSX', currency: 'CAD', region: 'Americas', price: 23950, vol: 0.12, factors: [{ f: 'EQ', b: 0.8 }, { f: 'US', b: 0.5 }, { f: 'ENERGY', b: 0.4 }] },
  { symbol: 'IBOV', name: 'Bovespa Index', type: 'index', exchange: 'B3', currency: 'BRL', region: 'Americas', price: 131800, vol: 0.20, factors: [{ f: 'EQ', b: 0.9 }, { f: 'METAL', b: 0.3 }, { f: 'USD', b: -0.5 }] },
  { symbol: 'SX5E', name: 'Euro Stoxx 50', type: 'index', exchange: 'EUREX', currency: 'EUR', region: 'EMEA', price: 4995, vol: 0.16, factors: [{ f: 'EQ', b: 0.95 }, { f: 'EU', b: 1 }] },
  { symbol: 'DAX', name: 'DAX 40 Index', type: 'index', exchange: 'XETRA', currency: 'EUR', region: 'EMEA', price: 19320, vol: 0.16, factors: [{ f: 'EQ', b: 0.95 }, { f: 'EU', b: 1 }, { f: 'IND', b: 0.3 }] },
  { symbol: 'CAC', name: 'CAC 40 Index', type: 'index', exchange: 'EURONEXT', currency: 'EUR', region: 'EMEA', price: 7640, vol: 0.15, factors: [{ f: 'EQ', b: 0.9 }, { f: 'EU', b: 1 }, { f: 'CONS', b: 0.3 }] },
  { symbol: 'UKX', name: 'FTSE 100 Index', type: 'index', exchange: 'LSE', currency: 'GBP', region: 'EMEA', price: 8240, vol: 0.12, factors: [{ f: 'EQ', b: 0.75 }, { f: 'EU', b: 0.8 }, { f: 'ENERGY', b: 0.3 }] },
  { symbol: 'SMI', name: 'Swiss Market Index', type: 'index', exchange: 'SIX', currency: 'CHF', region: 'EMEA', price: 12170, vol: 0.11, factors: [{ f: 'EQ', b: 0.65 }, { f: 'EU', b: 0.8 }, { f: 'HEALTH', b: 0.5 }] },
  { symbol: 'NKY', name: 'Nikkei 225', type: 'index', exchange: 'JPX', currency: 'JPY', region: 'Asia/Pacific', price: 38900, vol: 0.20, factors: [{ f: 'EQ', b: 0.9 }, { f: 'ASIA', b: 1 }, { f: 'USD', b: 0.6 }] },
  { symbol: 'HSI', name: 'Hang Seng Index', type: 'index', exchange: 'HKEX', currency: 'HKD', region: 'Asia/Pacific', price: 21130, vol: 0.24, factors: [{ f: 'EQ', b: 0.8 }, { f: 'ASIA', b: 1.4 }] },
  { symbol: 'SHCOMP', name: 'Shanghai Composite', type: 'index', exchange: 'SSE', currency: 'CNY', region: 'Asia/Pacific', price: 3340, vol: 0.20, factors: [{ f: 'EQ', b: 0.4 }, { f: 'ASIA', b: 1.2 }] },
  { symbol: 'AS51', name: 'S&P/ASX 200', type: 'index', exchange: 'ASX', currency: 'AUD', region: 'Asia/Pacific', price: 8200, vol: 0.12, factors: [{ f: 'EQ', b: 0.7 }, { f: 'ASIA', b: 0.5 }, { f: 'METAL', b: 0.3 }] },
  { symbol: 'VIX', name: 'CBOE Volatility Index', type: 'index', exchange: 'CBOE', currency: 'USD', region: 'Americas', price: 16.7, vol: 1.1, process: 'ou', mean: 17, kappa: 6, factors: [{ f: 'EQ', b: -5.5 }, { f: 'VOL', b: 1 }], tradable: false },

  // ── US equities ───────────────────────────────────────────────────
  eq('AAPL', 'Apple Inc', 'NASDAQ', 'USD', 'Technology', 'Consumer Electronics', 227.8, 0.25, US_TECH, { mktCap: 3460, pe: 34.5, divYield: 0.44, adv: 52e6 }),
  eq('MSFT', 'Microsoft Corp', 'NASDAQ', 'USD', 'Technology', 'Software—Infrastructure', 430.3, 0.24, US_TECH, { mktCap: 3200, pe: 36.1, divYield: 0.77, adv: 20e6 }),
  eq('NVDA', 'NVIDIA Corp', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 121.4, 0.50, [...US_TECH, { f: 'TECH', b: 0.6 }], { mktCap: 2980, pe: 56.8, divYield: 0.03, adv: 290e6 }),
  eq('AMZN', 'Amazon.com Inc', 'NASDAQ', 'USD', 'Consumer Discretionary', 'Internet Retail', 186.5, 0.30, [...US_TECH.slice(0, 2), { f: 'TECH', b: 0.7 }, { f: 'CONS', b: 0.4 }], { mktCap: 1960, pe: 44.2, divYield: 0, adv: 40e6 }),
  eq('GOOGL', 'Alphabet Inc Class A', 'NASDAQ', 'USD', 'Communication Services', 'Internet Content', 165.9, 0.28, US_COMM, { mktCap: 2040, pe: 23.6, divYield: 0.48, adv: 25e6 }),
  eq('META', 'Meta Platforms Inc', 'NASDAQ', 'USD', 'Communication Services', 'Internet Content', 572.4, 0.35, US_COMM, { mktCap: 1450, pe: 29.1, divYield: 0.35, adv: 12e6 }),
  eq('TSLA', 'Tesla Inc', 'NASDAQ', 'USD', 'Consumer Discretionary', 'Auto Manufacturers', 250.1, 0.58, [{ f: 'EQ', b: 1.6 }, { f: 'US', b: 1 }, { f: 'TECH', b: 0.8 }], { mktCap: 800, pe: 70.2, divYield: 0, adv: 85e6 }),
  eq('AMD', 'Advanced Micro Devices', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 162.0, 0.48, [...US_TECH, { f: 'TECH', b: 0.5 }], { mktCap: 262, pe: 47.0, divYield: 0, adv: 38e6 }),
  eq('AVGO', 'Broadcom Inc', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 172.6, 0.42, [...US_TECH, { f: 'TECH', b: 0.4 }], { mktCap: 805, pe: 33.5, divYield: 1.2, adv: 25e6 }),
  eq('INTC', 'Intel Corp', 'NASDAQ', 'USD', 'Technology', 'Semiconductors', 23.4, 0.45, US_TECH, { mktCap: 101, pe: 25.0, divYield: 2.1, adv: 60e6 }),
  eq('ORCL', 'Oracle Corp', 'NYSE', 'USD', 'Technology', 'Software—Infrastructure', 170.4, 0.30, US_TECH, { mktCap: 472, pe: 44.0, divYield: 0.94, adv: 9e6 }),
  eq('CRM', 'Salesforce Inc', 'NYSE', 'USD', 'Technology', 'Software—Application', 273.7, 0.32, US_TECH, { mktCap: 262, pe: 46.0, divYield: 0.58, adv: 6e6 }),
  eq('NFLX', 'Netflix Inc', 'NASDAQ', 'USD', 'Communication Services', 'Entertainment', 709.3, 0.36, US_COMM, { mktCap: 303, pe: 40.3, divYield: 0, adv: 3e6 }),
  eq('JPM', 'JPMorgan Chase & Co', 'NYSE', 'USD', 'Financials', 'Banks—Diversified', 210.9, 0.22, US_FIN, { mktCap: 600, pe: 11.8, divYield: 2.3, adv: 9e6 }),
  eq('BAC', 'Bank of America Corp', 'NYSE', 'USD', 'Financials', 'Banks—Diversified', 39.7, 0.27, US_FIN, { mktCap: 307, pe: 13.8, divYield: 2.6, adv: 35e6 }),
  eq('GS', 'Goldman Sachs Group', 'NYSE', 'USD', 'Financials', 'Capital Markets', 495.1, 0.27, US_FIN, { mktCap: 157, pe: 14.6, divYield: 2.4, adv: 2.3e6 }),
  eq('MS', 'Morgan Stanley', 'NYSE', 'USD', 'Financials', 'Capital Markets', 104.2, 0.26, US_FIN, { mktCap: 169, pe: 16.3, divYield: 3.5, adv: 7e6 }),
  eq('V', 'Visa Inc Class A', 'NYSE', 'USD', 'Financials', 'Credit Services', 274.9, 0.19, [{ f: 'EQ', b: 0.9 }, { f: 'US', b: 1 }, { f: 'FIN', b: 0.6 }, { f: 'TECH', b: 0.3 }], { mktCap: 545, pe: 29.2, divYield: 0.8, adv: 7e6 }),
  eq('MA', 'Mastercard Inc Class A', 'NYSE', 'USD', 'Financials', 'Credit Services', 493.8, 0.20, [{ f: 'EQ', b: 0.95 }, { f: 'US', b: 1 }, { f: 'FIN', b: 0.6 }, { f: 'TECH', b: 0.3 }], { mktCap: 456, pe: 37.1, divYield: 0.53, adv: 2.7e6 }),
  eq('BRK.B', 'Berkshire Hathaway Class B', 'NYSE', 'USD', 'Financials', 'Insurance—Diversified', 460.3, 0.16, [{ f: 'EQ', b: 0.8 }, { f: 'US', b: 1 }, { f: 'FIN', b: 0.5 }], { mktCap: 990, pe: 13.3, divYield: 0, adv: 3.5e6 }),
  eq('XOM', 'Exxon Mobil Corp', 'NYSE', 'USD', 'Energy', 'Oil & Gas Integrated', 117.2, 0.24, US_ENERGY, { mktCap: 515, pe: 14.4, divYield: 3.3, adv: 15e6 }),
  eq('CVX', 'Chevron Corp', 'NYSE', 'USD', 'Energy', 'Oil & Gas Integrated', 147.3, 0.24, US_ENERGY, { mktCap: 268, pe: 16.4, divYield: 4.4, adv: 7e6 }),
  eq('LLY', 'Eli Lilly & Co', 'NYSE', 'USD', 'Health Care', 'Drug Manufacturers', 886.0, 0.30, US_HEALTH, { mktCap: 842, pe: 130.0, divYield: 0.59, adv: 3e6 }),
  eq('UNH', 'UnitedHealth Group', 'NYSE', 'USD', 'Health Care', 'Healthcare Plans', 584.7, 0.22, US_HEALTH, { mktCap: 540, pe: 38.0, divYield: 1.4, adv: 3e6 }),
  eq('JNJ', 'Johnson & Johnson', 'NYSE', 'USD', 'Health Care', 'Drug Manufacturers', 162.1, 0.15, US_HEALTH, { mktCap: 390, pe: 23.5, divYield: 3.0, adv: 6.5e6 }),
  eq('PFE', 'Pfizer Inc', 'NYSE', 'USD', 'Health Care', 'Drug Manufacturers', 28.9, 0.22, US_HEALTH, { mktCap: 164, pe: 38.6, divYield: 5.8, adv: 30e6 }),
  eq('WMT', 'Walmart Inc', 'NYSE', 'USD', 'Consumer Staples', 'Discount Stores', 80.8, 0.17, US_CONS, { mktCap: 650, pe: 34.0, divYield: 1.0, adv: 15e6 }),
  eq('KO', 'Coca-Cola Co', 'NYSE', 'USD', 'Consumer Staples', 'Beverages', 71.9, 0.13, US_CONS, { mktCap: 310, pe: 29.0, divYield: 2.7, adv: 13e6 }),
  eq('PG', 'Procter & Gamble Co', 'NYSE', 'USD', 'Consumer Staples', 'Household Products', 173.2, 0.14, US_CONS, { mktCap: 408, pe: 28.0, divYield: 2.3, adv: 6e6 }),
  eq('HD', 'Home Depot Inc', 'NYSE', 'USD', 'Consumer Discretionary', 'Home Improvement Retail', 405.2, 0.21, [{ f: 'EQ', b: 1.0 }, { f: 'US', b: 1 }, { f: 'CONS', b: 0.8 }], { mktCap: 402, pe: 27.0, divYield: 2.2, adv: 3.3e6 }),
  eq('MCD', "McDonald's Corp", 'NYSE', 'USD', 'Consumer Discretionary', 'Restaurants', 304.5, 0.16, US_CONS, { mktCap: 218, pe: 26.5, divYield: 2.2, adv: 3.5e6 }),
  eq('DIS', 'Walt Disney Co', 'NYSE', 'USD', 'Communication Services', 'Entertainment', 96.2, 0.26, US_COMM, { mktCap: 175, pe: 35.0, divYield: 0.8, adv: 9e6 }),
  eq('BA', 'Boeing Co', 'NYSE', 'USD', 'Industrials', 'Aerospace & Defense', 152.0, 0.34, US_IND, { mktCap: 94, pe: -1, divYield: 0, adv: 8e6 }),
  eq('CAT', 'Caterpillar Inc', 'NYSE', 'USD', 'Industrials', 'Farm & Heavy Machinery', 391.1, 0.26, [...US_IND, { f: 'METAL', b: 0.2 }], { mktCap: 190, pe: 18.2, divYield: 1.4, adv: 2.5e6 }),
  eq('GE', 'GE Aerospace', 'NYSE', 'USD', 'Industrials', 'Aerospace & Defense', 188.6, 0.30, US_IND, { mktCap: 205, pe: 38.0, divYield: 0.6, adv: 5e6 }),

  // ── International equities ─────────────────────────────────────────
  eq('ASML', 'ASML Holding NV', 'EURONEXT', 'EUR', 'Technology', 'Semiconductor Equipment', 748.0, 0.38, [{ f: 'EQ', b: 1.2 }, { f: 'EU', b: 0.8 }, { f: 'TECH', b: 1.2 }], { mktCap: 295, pe: 39.0, divYield: 0.85, adv: 1.1e6, region: 'EMEA' }),
  eq('SAP', 'SAP SE', 'XETRA', 'EUR', 'Technology', 'Software—Application', 205.6, 0.25, [{ f: 'EQ', b: 1.0 }, { f: 'EU', b: 0.9 }, { f: 'TECH', b: 0.8 }], { mktCap: 240, pe: 45.0, divYield: 1.1, adv: 1.6e6, region: 'EMEA' }),
  eq('MC', 'LVMH Moet Hennessy', 'EURONEXT', 'EUR', 'Consumer Discretionary', 'Luxury Goods', 676.5, 0.28, [{ f: 'EQ', b: 1.0 }, { f: 'EU', b: 1 }, { f: 'ASIA', b: 0.5 }, { f: 'CONS', b: 0.6 }], { mktCap: 338, pe: 23.0, divYield: 1.9, adv: 0.5e6, region: 'EMEA' }),
  eq('TTE', 'TotalEnergies SE', 'EURONEXT', 'EUR', 'Energy', 'Oil & Gas Integrated', 58.6, 0.22, [{ f: 'EQ', b: 0.8 }, { f: 'EU', b: 1 }, { f: 'ENERGY', b: 1 }, { f: 'OIL', b: 0.35 }], { mktCap: 135, pe: 7.8, divYield: 5.4, adv: 4e6, region: 'EMEA' }),
  eq('SIE', 'Siemens AG', 'XETRA', 'EUR', 'Industrials', 'Specialty Industrial Machinery', 181.4, 0.24, [{ f: 'EQ', b: 1.0 }, { f: 'EU', b: 1 }, { f: 'IND', b: 1 }], { mktCap: 145, pe: 18.5, divYield: 2.8, adv: 1.5e6, region: 'EMEA' }),
  eq('NESN', 'Nestle SA', 'SIX', 'CHF', 'Consumer Staples', 'Packaged Foods', 85.2, 0.15, [{ f: 'EQ', b: 0.55 }, { f: 'EU', b: 0.8 }, { f: 'CONS', b: 1 }], { mktCap: 228, pe: 19.6, divYield: 3.5, adv: 4e6, region: 'EMEA' }),
  eq('SHEL', 'Shell PLC', 'LSE', 'GBP', 'Energy', 'Oil & Gas Integrated', 24.9, 0.23, [{ f: 'EQ', b: 0.8 }, { f: 'EU', b: 0.9 }, { f: 'ENERGY', b: 1 }, { f: 'OIL', b: 0.4 }], { mktCap: 205, pe: 12.5, divYield: 4.0, adv: 10e6, region: 'EMEA' }),
  eq('HSBA', 'HSBC Holdings PLC', 'LSE', 'GBP', 'Financials', 'Banks—Diversified', 6.88, 0.22, [{ f: 'EQ', b: 0.9 }, { f: 'EU', b: 0.7 }, { f: 'ASIA', b: 0.6 }, { f: 'FIN', b: 1 }], { mktCap: 165, pe: 7.4, divYield: 7.0, adv: 25e6, region: 'EMEA', tick: 0.001, decimals: 3 }),
  eq('7203', 'Toyota Motor Corp', 'JPX', 'JPY', 'Consumer Discretionary', 'Auto Manufacturers', 2615, 0.30, [{ f: 'EQ', b: 0.9 }, { f: 'ASIA', b: 1 }, { f: 'USD', b: 0.8 }], { mktCap: 41000, pe: 7.6, divYield: 2.9, adv: 25e6, region: 'Asia/Pacific', tick: 0.5, decimals: 1, lot: 100 }),
  eq('6758', 'Sony Group Corp', 'JPX', 'JPY', 'Technology', 'Consumer Electronics', 2840, 0.32, [{ f: 'EQ', b: 1.0 }, { f: 'ASIA', b: 1 }, { f: 'TECH', b: 0.6 }], { mktCap: 17500, pe: 18.0, divYield: 0.7, adv: 8e6, region: 'Asia/Pacific', tick: 0.5, decimals: 1, lot: 100 }),
  eq('700', 'Tencent Holdings', 'HKEX', 'HKD', 'Communication Services', 'Internet Content', 432.0, 0.36, [{ f: 'EQ', b: 0.9 }, { f: 'ASIA', b: 1.4 }, { f: 'TECH', b: 0.7 }], { mktCap: 4000, pe: 23.0, divYield: 0.8, adv: 20e6, region: 'Asia/Pacific', tick: 0.2, decimals: 1, lot: 100 }),
  eq('TSM', 'Taiwan Semiconductor ADR', 'NYSE', 'USD', 'Technology', 'Semiconductors', 175.2, 0.38, [{ f: 'EQ', b: 1.2 }, { f: 'ASIA', b: 0.8 }, { f: 'TECH', b: 1.3 }], { mktCap: 908, pe: 28.5, divYield: 1.2, adv: 15e6, region: 'Asia/Pacific' }),

  // ── ETFs ──────────────────────────────────────────────────────────
  eq('SPY', 'SPDR S&P 500 ETF Trust', 'NYSE', 'USD', 'ETF', 'Large Blend', 573.8, 0.15, [{ f: 'EQ', b: 1 }, { f: 'US', b: 1 }, { f: 'TECH', b: 0.3 }], { type: 'etf', adv: 45e6, spreadBps: 0.3, mktCap: 520 }),
  eq('QQQ', 'Invesco QQQ Trust', 'NASDAQ', 'USD', 'ETF', 'Large Growth', 488.1, 0.20, [{ f: 'EQ', b: 1.15 }, { f: 'US', b: 1 }, { f: 'TECH', b: 0.8 }], { type: 'etf', adv: 35e6, spreadBps: 0.4, mktCap: 300 }),
  eq('IWM', 'iShares Russell 2000 ETF', 'NYSE', 'USD', 'ETF', 'Small Blend', 220.9, 0.21, [{ f: 'EQ', b: 1.2 }, { f: 'US', b: 1.3 }, { f: 'FIN', b: 0.4 }], { type: 'etf', adv: 30e6, spreadBps: 0.5, mktCap: 68 }),
  eq('TLT', 'iShares 20+ Year Treasury', 'NASDAQ', 'USD', 'ETF', 'Long Government', 98.1, 0.15, [{ f: 'RATES', b: -0.16 }], { type: 'etf', adv: 30e6, spreadBps: 1, mktCap: 60 }),
  eq('GLD', 'SPDR Gold Shares', 'NYSE', 'USD', 'ETF', 'Commodities Precious Metals', 245.6, 0.15, [{ f: 'METAL', b: 1 }, { f: 'USD', b: -0.6 }], { type: 'etf', adv: 7e6, spreadBps: 1, mktCap: 73 }),
  eq('EEM', 'iShares MSCI Emerging Mkts', 'NYSE', 'USD', 'ETF', 'Diversified Emerging Mkts', 45.8, 0.18, [{ f: 'EQ', b: 0.8 }, { f: 'ASIA', b: 1 }, { f: 'USD', b: -0.5 }], { type: 'etf', adv: 25e6, spreadBps: 2, mktCap: 19 }),

  // ── FX (quote currency in `currency`, base in `base`) ─────────────
  { symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'fx', base: 'EUR', currency: 'USD', price: 1.1135, vol: 0.07, factors: [{ f: 'USD', b: -1 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 0.6 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'fx', base: 'GBP', currency: 'USD', price: 1.3370, vol: 0.08, factors: [{ f: 'USD', b: -0.9 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 0.8 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'fx', base: 'USD', currency: 'JPY', price: 143.60, vol: 0.10, factors: [{ f: 'USD', b: 1 }, { f: 'RATES', b: 0.03 }], tick: 0.001, decimals: 3, lot: 1000, spreadBps: 0.7 },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'fx', base: 'USD', currency: 'CHF', price: 0.8455, vol: 0.08, factors: [{ f: 'USD', b: 1 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 1 },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'fx', base: 'AUD', currency: 'USD', price: 0.6910, vol: 0.10, factors: [{ f: 'USD', b: -0.9 }, { f: 'EQ', b: 0.2 }, { f: 'METAL', b: 0.2 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 1 },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'fx', base: 'USD', currency: 'CAD', price: 1.3520, vol: 0.06, factors: [{ f: 'USD', b: 0.7 }, { f: 'OIL', b: -0.05 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 1 },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', type: 'fx', base: 'NZD', currency: 'USD', price: 0.6350, vol: 0.10, factors: [{ f: 'USD', b: -0.9 }, { f: 'EQ', b: 0.2 }], tick: 0.00001, decimals: 5, lot: 1000, spreadBps: 1.5 },
  { symbol: 'USDCNH', name: 'US Dollar / Offshore Yuan', type: 'fx', base: 'USD', currency: 'CNY', price: 7.0150, vol: 0.04, factors: [{ f: 'USD', b: 0.4 }], tick: 0.0001, decimals: 4, lot: 1000, spreadBps: 1.5 },
  { symbol: 'USDHKD', name: 'US Dollar / Hong Kong Dollar', type: 'fx', base: 'USD', currency: 'HKD', price: 7.7720, vol: 0.005, factors: [], tick: 0.0001, decimals: 4, lot: 1000, spreadBps: 0.5 },
  { symbol: 'USDBRL', name: 'US Dollar / Brazilian Real', type: 'fx', base: 'USD', currency: 'BRL', price: 5.4400, vol: 0.15, factors: [{ f: 'USD', b: 0.8 }, { f: 'EQ', b: -0.2 }], tick: 0.0001, decimals: 4, lot: 1000, spreadBps: 3 },

  // ── Crypto ────────────────────────────────────────────────────────
  { symbol: 'BTCUSD', name: 'Bitcoin', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 63250, vol: 0.55, factors: [{ f: 'CRYPTO', b: 0.9 }, { f: 'EQ', b: 0.5 }], tick: 0.5, decimals: 1, lot: 0.0001, spreadBps: 1.5, adv: 28000, mktCap: 1250 },
  { symbol: 'ETHUSD', name: 'Ethereum', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 2610, vol: 0.68, factors: [{ f: 'CRYPTO', b: 1.0 }, { f: 'EQ', b: 0.5 }], tick: 0.01, decimals: 2, lot: 0.001, spreadBps: 2, adv: 450000, mktCap: 314 },
  { symbol: 'SOLUSD', name: 'Solana', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 151.4, vol: 0.85, factors: [{ f: 'CRYPTO', b: 1.2 }, { f: 'EQ', b: 0.4 }], tick: 0.01, decimals: 2, lot: 0.01, spreadBps: 3, adv: 4e6, mktCap: 71 },
  { symbol: 'BNBUSD', name: 'BNB', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 583.2, vol: 0.55, factors: [{ f: 'CRYPTO', b: 0.8 }], tick: 0.01, decimals: 2, lot: 0.01, spreadBps: 3, adv: 7e5, mktCap: 85 },
  { symbol: 'XRPUSD', name: 'XRP', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 0.5912, vol: 0.80, factors: [{ f: 'CRYPTO', b: 0.9 }], tick: 0.0001, decimals: 4, lot: 1, spreadBps: 4, adv: 1.5e9, mktCap: 33 },
  { symbol: 'ADAUSD', name: 'Cardano', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 0.3620, vol: 0.85, factors: [{ f: 'CRYPTO', b: 1.1 }], tick: 0.0001, decimals: 4, lot: 1, spreadBps: 5, adv: 6e8, mktCap: 13 },
  { symbol: 'DOGEUSD', name: 'Dogecoin', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 0.1112, vol: 1.0, factors: [{ f: 'CRYPTO', b: 1.2 }], tick: 0.00001, decimals: 5, lot: 1, spreadBps: 5, adv: 6e9, mktCap: 16 },
  { symbol: 'AVAXUSD', name: 'Avalanche', type: 'crypto', exchange: 'CRYPTO', currency: 'USD', price: 27.3, vol: 0.90, factors: [{ f: 'CRYPTO', b: 1.2 }], tick: 0.01, decimals: 2, lot: 0.01, spreadBps: 5, adv: 1.2e7, mktCap: 11 },

  // ── Commodities (front-month futures) ───────────────────────────────
  { symbol: 'CL1', name: 'WTI Crude Oil Future', type: 'commodity', exchange: 'NYMEX', currency: 'USD', unit: 'USD/bbl', group: 'Energy', price: 68.2, vol: 0.32, factors: [{ f: 'OIL', b: 1 }, { f: 'EQ', b: 0.25 }], tick: 0.01, decimals: 2, multiplier: 1000, lot: 1, spreadBps: 1.5, adv: 350000 },
  { symbol: 'CO1', name: 'Brent Crude Future', type: 'commodity', exchange: 'ICE', currency: 'USD', unit: 'USD/bbl', group: 'Energy', price: 71.7, vol: 0.30, factors: [{ f: 'OIL', b: 0.98 }, { f: 'EQ', b: 0.2 }], tick: 0.01, decimals: 2, multiplier: 1000, lot: 1, spreadBps: 1.5, adv: 250000 },
  { symbol: 'NG1', name: 'Natural Gas Future', type: 'commodity', exchange: 'NYMEX', currency: 'USD', unit: 'USD/MMBtu', group: 'Energy', price: 2.92, vol: 0.60, factors: [{ f: 'OIL', b: 0.2 }], tick: 0.001, decimals: 3, multiplier: 10000, lot: 1, spreadBps: 3, adv: 150000 },
  { symbol: 'GC1', name: 'Gold Future', type: 'commodity', exchange: 'COMEX', currency: 'USD', unit: 'USD/t oz', group: 'Metals', price: 2668.5, vol: 0.15, factors: [{ f: 'METAL', b: 1 }, { f: 'USD', b: -0.6 }], tick: 0.1, decimals: 1, multiplier: 100, lot: 1, spreadBps: 1, adv: 200000 },
  { symbol: 'SI1', name: 'Silver Future', type: 'commodity', exchange: 'COMEX', currency: 'USD', unit: 'USD/t oz', group: 'Metals', price: 31.45, vol: 0.28, factors: [{ f: 'METAL', b: 1.4 }, { f: 'USD', b: -0.5 }, { f: 'EQ', b: 0.2 }], tick: 0.005, decimals: 3, multiplier: 5000, lot: 1, spreadBps: 2, adv: 70000 },
  { symbol: 'HG1', name: 'Copper Future', type: 'commodity', exchange: 'COMEX', currency: 'USD', unit: 'USD/lb', group: 'Metals', price: 4.56, vol: 0.24, factors: [{ f: 'METAL', b: 0.6 }, { f: 'EQ', b: 0.5 }, { f: 'ASIA', b: 0.6 }], tick: 0.0005, decimals: 4, multiplier: 25000, lot: 1, spreadBps: 2, adv: 80000 },
  { symbol: 'PL1', name: 'Platinum Future', type: 'commodity', exchange: 'NYMEX', currency: 'USD', unit: 'USD/t oz', group: 'Metals', price: 985.0, vol: 0.26, factors: [{ f: 'METAL', b: 0.9 }, { f: 'EQ', b: 0.3 }], tick: 0.1, decimals: 1, multiplier: 50, lot: 1, spreadBps: 3, adv: 30000 },
  { symbol: 'C1', name: 'Corn Future', type: 'commodity', exchange: 'CBOT', currency: 'USD', unit: 'USc/bu', group: 'Agriculture', price: 421.25, vol: 0.22, factors: [{ f: 'AGS', b: 1 }], tick: 0.25, decimals: 2, multiplier: 50, lot: 1, spreadBps: 3, adv: 250000 },
  { symbol: 'W1', name: 'Wheat Future', type: 'commodity', exchange: 'CBOT', currency: 'USD', unit: 'USc/bu', group: 'Agriculture', price: 584.5, vol: 0.30, factors: [{ f: 'AGS', b: 1 }], tick: 0.25, decimals: 2, multiplier: 50, lot: 1, spreadBps: 3, adv: 100000 },
  { symbol: 'S1', name: 'Soybean Future', type: 'commodity', exchange: 'CBOT', currency: 'USD', unit: 'USc/bu', group: 'Agriculture', price: 1052.0, vol: 0.20, factors: [{ f: 'AGS', b: 0.9 }], tick: 0.25, decimals: 2, multiplier: 50, lot: 1, spreadBps: 3, adv: 120000 },
  { symbol: 'KC1', name: 'Coffee Future', type: 'commodity', exchange: 'ICE', currency: 'USD', unit: 'USc/lb', group: 'Agriculture', price: 268.4, vol: 0.38, factors: [{ f: 'AGS', b: 0.5 }], tick: 0.05, decimals: 2, multiplier: 375, lot: 1, spreadBps: 5, adv: 30000 },

  // ── Government bond yields (percent) ─────────────────────────────────
  { symbol: 'USGG2YR', name: 'US Treasury 2 Year Yield', type: 'rate', country: 'US', tenor: 2, currency: 'USD', price: 3.62, vol: 0.95, process: 'abs', factors: [{ f: 'RATES', b: 1.05 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'USGG5YR', name: 'US Treasury 5 Year Yield', type: 'rate', country: 'US', tenor: 5, currency: 'USD', price: 3.51, vol: 0.95, process: 'abs', factors: [{ f: 'RATES', b: 1.0 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'USGG10YR', name: 'US Treasury 10 Year Yield', type: 'rate', country: 'US', tenor: 10, currency: 'USD', price: 3.79, vol: 0.85, process: 'abs', factors: [{ f: 'RATES', b: 0.92 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'USGG30YR', name: 'US Treasury 30 Year Yield', type: 'rate', country: 'US', tenor: 30, currency: 'USD', price: 4.12, vol: 0.80, process: 'abs', factors: [{ f: 'RATES', b: 0.85 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'GDBR10', name: 'Germany 10 Year Bund Yield', type: 'rate', country: 'DE', tenor: 10, currency: 'EUR', price: 2.13, vol: 0.75, process: 'abs', factors: [{ f: 'RATES', b: 0.6 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'GUKG10', name: 'UK 10 Year Gilt Yield', type: 'rate', country: 'GB', tenor: 10, currency: 'GBP', price: 4.00, vol: 0.85, process: 'abs', factors: [{ f: 'RATES', b: 0.7 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'GJGB10', name: 'Japan 10 Year JGB Yield', type: 'rate', country: 'JP', tenor: 10, currency: 'JPY', price: 0.86, vol: 0.30, process: 'abs', factors: [{ f: 'RATES', b: 0.15 }], tick: 0.001, decimals: 3, tradable: false },
  { symbol: 'GFRN10', name: 'France 10 Year OAT Yield', type: 'rate', country: 'FR', tenor: 10, currency: 'EUR', price: 2.92, vol: 0.75, process: 'abs', factors: [{ f: 'RATES', b: 0.6 }], tick: 0.001, decimals: 3, tradable: false },
];

const DEFAULTS = {
  index: { tick: 0.01, decimals: 2, multiplier: 1, lot: 1, spreadBps: 1, adv: 0, tradable: true },
  equity: {},
  etf: {},
  fx: { exchange: 'FX', multiplier: 1, adv: 0, tradable: true },
  crypto: { multiplier: 1, tradable: true },
  commodity: { tradable: true },
  rate: { exchange: 'GOVT', multiplier: 1, lot: 1, spreadBps: 0, adv: 0 },
};

const REGION_BY_CCY = { USD: 'Americas', CAD: 'Americas', BRL: 'Americas', EUR: 'EMEA', GBP: 'EMEA', CHF: 'EMEA', JPY: 'Asia/Pacific', HKD: 'Asia/Pacific', CNY: 'Asia/Pacific', AUD: 'Asia/Pacific' };

export function buildUniverse() {
  const map = new Map();
  for (const raw of INSTRUMENTS) {
    const inst = { ...DEFAULTS[raw.type], ...raw };
    inst.region ??= REGION_BY_CCY[inst.currency] || 'Global';
    inst.adv ??= 1e6;
    inst.process ??= 'gbm';
    inst.tradable ??= true;
    map.set(inst.symbol, inst);
  }
  return map;
}

export const ASSET_CLASS_LABEL = {
  index: 'Index', equity: 'Equity', etf: 'ETF', fx: 'Currency', crypto: 'Crypto', commodity: 'Commodity', rate: 'Govt',
};
