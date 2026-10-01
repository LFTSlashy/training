import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const OPS = {
  '>=': (v, x) => v >= x,
  '<=': (v, x) => v <= x,
};
const FIELDS = ['last', 'changePct', 'volume'];

export class AlertManager extends EventEmitter {
  constructor(engine, store) {
    super();
    this.engine = engine;
    this.store = store;
  }

  list(userId) {
    return this.store.get('alerts', userId) || [];
  }

  create(userId, input) {
    const symbol = String(input.symbol || '').toUpperCase();
    if (!this.engine.has(symbol)) throw Object.assign(new Error(`Unknown security ${symbol}`), { status: 400 });
    const op = input.op === '<=' ? '<=' : '>=';
    const field = FIELDS.includes(input.field) ? input.field : 'last';
    const value = Number(input.value);
    if (!Number.isFinite(value)) throw Object.assign(new Error('Alert value must be a number'), { status: 400 });
    const alerts = this.list(userId);
    if (alerts.filter((a) => a.active).length >= 100) throw Object.assign(new Error('Too many active alerts (max 100)'), { status: 400 });
    const alert = {
      id: `A${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      symbol, op, field, value,
      note: input.note ? String(input.note).slice(0, 120) : '',
      active: true,
      createdAt: Date.now(),
      triggeredAt: null,
      triggerValue: null,
    };
    this.store.set('alerts', userId, [...alerts, alert]);
    return alert;
  }

  remove(userId, id) {
    this.store.set('alerts', userId, this.list(userId).filter((a) => a.id !== id));
  }

  rearm(userId, id) {
    const alerts = this.list(userId);
    const a = alerts.find((x) => x.id === id);
    if (a) { a.active = true; a.triggeredAt = null; this.store.save(); }
    return a;
  }

  onTick() {
    const all = this.store.data.alerts || {};
    for (const [userId, alerts] of Object.entries(all)) {
      for (const a of alerts) {
        if (!a.active) continue;
        const q = this.engine.quote(a.symbol);
        if (!q) continue;
        const v = q[a.field];
        if (OPS[a.op](v, a.value)) {
          a.active = false;
          a.triggeredAt = Date.now();
          a.triggerValue = v;
          this.store.save();
          this.emit('triggered', userId, a);
        }
      }
    }
  }
}
