import { WebSocketServer } from 'ws';

const QUOTE_FIELDS = ['last', 'bid', 'ask', 'change', 'changePct', 'volume', 'high', 'low', 'open', 'prevClose', 'dir', 'bidSize', 'askSize', 'vwap'];

/**
 * Real-time gateway.
 *   server → client: hello, quotes (compact columnar batches), book, tape, news, order, fill, account, alert
 *   client → server: { type: 'sub' | 'unsub', channel: 'book' | 'tape', symbol }, { type: 'ping' }
 */
export function attachWebSocket(server, { engine, oms, alerts, news, auth }) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });
  const clients = new Set();

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN && ws.bufferedAmount < 2_000_000) ws.send(JSON.stringify(msg));
  };

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const user = auth.verify(url.searchParams.get('token'));
    if (!user) {
      ws.close(4401, 'Unauthorized');
      return;
    }
    const client = { ws, user, book: new Set(), tape: new Set(), alive: true };
    clients.add(client);
    ws.on('pong', () => { client.alive = true; });
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      const symbol = String(msg.symbol || '').toUpperCase();
      if ((msg.type === 'sub' || msg.type === 'unsub') && (msg.channel === 'book' || msg.channel === 'tape') && engine.has(symbol)) {
        const set = client[msg.channel];
        if (msg.type === 'sub' && set.size < 20) set.add(symbol);
        else set.delete(symbol);
        if (msg.type === 'sub') {
          send(ws, msg.channel === 'book' ? { type: 'book', data: engine.book(symbol, 15) } : { type: 'tape', symbol, data: engine.tape(symbol, 60) });
        }
      } else if (msg.type === 'ping') {
        send(ws, { type: 'pong', t: Date.now() });
      }
    });
    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));
    send(ws, { type: 'hello', user: { id: user.id, username: user.username }, fields: QUOTE_FIELDS, quotes: compact(engine.quotes()), account: oms.summary(user.id), t: Date.now() });
  });

  const compact = (quotes) => {
    const out = {};
    for (const [s, q] of Object.entries(quotes)) out[s] = QUOTE_FIELDS.map((f) => q[f]);
    return out;
  };

  let n = 0;
  engine.on('tick', (changed, now) => {
    n++;
    if (!clients.size) return;
    const quotes = compact(engine.quotes(changed));
    const tapeCache = new Map();
    for (const c of clients) {
      send(c.ws, { type: 'quotes', t: now, q: quotes });
      for (const s of c.book) send(c.ws, { type: 'book', data: engine.book(s, 15) });
      for (const s of c.tape) {
        if (!tapeCache.has(s)) tapeCache.set(s, engine.tape(s, 12));
        send(c.ws, { type: 'tape', symbol: s, data: tapeCache.get(s), incremental: true });
      }
      if (n % 2 === 0) send(c.ws, { type: 'account', data: oms.summary(c.user.id) });
    }
  });

  const toUser = (userId, msg) => {
    for (const c of clients) if (c.user.id === userId) send(c.ws, msg);
  };
  oms.on('order', (userId, order) => toUser(userId, { type: 'order', data: order }));
  oms.on('fill', (userId, fill) => toUser(userId, { type: 'fill', data: fill }));
  oms.on('account', (userId) => toUser(userId, { type: 'account', data: oms.summary(userId) }));
  alerts.on('triggered', (userId, alert) => toUser(userId, { type: 'alert', data: alert }));

  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (!c.alive) { c.ws.terminate(); clients.delete(c); continue; }
      c.alive = false;
      c.ws.ping();
    }
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));

  return {
    wss,
    broadcast(msg) { for (const c of clients) send(c.ws, msg); },
    get size() { return clients.size; },
  };
}
