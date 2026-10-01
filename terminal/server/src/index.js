import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { config } from './config.js';
import { Store } from './lib/store.js';
import { Auth } from './auth.js';
import { MarketEngine } from './market/engine.js';
import { NewsWire } from './market/news.js';
import { OrderManager } from './trading/oms.js';
import { AlertManager } from './trading/alerts.js';
import { apiRouter } from './routes/api.js';
import { attachWebSocket } from './ws.js';

export function createApp(cfg = config) {
  const store = new Store(cfg.dataDir);
  const secret = cfg.jwtSecret || store.readSecret('.jwt-secret', () => crypto.randomBytes(48).toString('hex'));
  const auth = new Auth(store, { secret, ttlSec: cfg.tokenTtlSec });

  const t0 = Date.now();
  const engine = new MarketEngine({ seed: cfg.seed, tickMs: cfg.tickMs, simSpeed: cfg.simSpeed, historyDays: cfg.historyDays });
  const news = new NewsWire(engine, { seed: cfg.seed });
  const oms = new OrderManager(engine, store, { startingCash: cfg.startingCash, maxLeverage: cfg.maxLeverage });
  const alerts = new AlertManager(engine, store);
  console.log(`[market] ${engine.universe.size} instruments, ${cfg.historyDays}d history generated in ${Date.now() - t0}ms`);

  if (cfg.createDemoUser && !auth.findByUsername(cfg.demoUser)) {
    const demo = auth.register(cfg.demoUser, cfg.demoPassword, 'Demo Trader');
    oms.account(demo.id);
    console.log(`[auth] demo account created → ${cfg.demoUser} / ${cfg.demoPassword}`);
  }

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        scriptSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', apiRouter({ engine, oms, alerts, news, auth, store, config: cfg }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (fs.existsSync(path.join(cfg.publicDir, 'index.html'))) {
    app.use(express.static(cfg.publicDir, { maxAge: '1h', index: false }));
    app.get('*', (req, res) => res.sendFile(path.join(cfg.publicDir, 'index.html')));
  } else {
    app.get('/', (req, res) => res.type('text').send('QUANTA API running. Build the client (npm run build) or use the Vite dev server on :5173.'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error('[api]', err);
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  const server = http.createServer(app);
  const ws = attachWebSocket(server, { engine, oms, alerts, news, auth });

  engine.on('tick', (_, now) => {
    oms.onTick(now);
    alerts.onTick(now);
  });

  const start = () => {
    engine.start();
    news.start((item) => ws.broadcast({ type: 'news', data: item }));
    return new Promise((resolve) => server.listen(cfg.port, cfg.host, () => resolve(server)));
  };
  const stop = () => {
    engine.stop();
    news.stop();
    store.flush();
    ws.wss.close();
    return new Promise((resolve) => server.close(() => resolve()));
  };

  return { app, server, engine, oms, alerts, news, auth, store, start, stop };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const ctx = createApp();
  ctx.start().then(() => {
    console.log(`[http] QUANTA terminal listening on http://localhost:${config.port}`);
  });
  const shutdown = async (sig) => {
    console.log(`[http] ${sig} received, shutting down`);
    await ctx.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
