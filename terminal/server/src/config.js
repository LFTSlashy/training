import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

export const config = {
  port: num(process.env.PORT, 8080),
  host: process.env.HOST || '0.0.0.0',
  dataDir: process.env.DATA_DIR || path.resolve(here, '../data'),
  publicDir: process.env.PUBLIC_DIR || path.resolve(here, '../../client/dist'),
  jwtSecret: process.env.JWT_SECRET || null, // generated and persisted when absent
  tokenTtlSec: num(process.env.TOKEN_TTL_SEC, 60 * 60 * 24 * 7),
  // Market simulation
  seed: num(process.env.MARKET_SEED, 1234),
  tickMs: num(process.env.TICK_MS, 500),
  simSpeed: num(process.env.SIM_SPEED, 3), // volatility time multiplier for intraday moves
  historyDays: num(process.env.HISTORY_DAYS, 750),
  // Trading
  startingCash: num(process.env.STARTING_CASH, 1_000_000),
  maxLeverage: num(process.env.MAX_LEVERAGE, 4),
  // Demo account
  createDemoUser: process.env.DEMO_USER !== 'false',
  demoUser: process.env.DEMO_USERNAME || 'demo',
  demoPassword: process.env.DEMO_PASSWORD || 'demo1234',
};
