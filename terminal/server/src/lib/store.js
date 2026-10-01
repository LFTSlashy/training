import fs from 'node:fs';
import path from 'node:path';

/**
 * Tiny JSON document store with debounced atomic writes.
 * Good enough for a single-node terminal; swap for a real DB behind the same API if needed.
 */
export class Store {
  constructor(dir, name = 'db.json') {
    this.dir = dir;
    this.file = path.join(dir, name);
    this.timer = null;
    this.data = { users: {}, accounts: {}, watchlists: {}, alerts: {}, layouts: {} };
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(this.file)) {
      try {
        this.data = { ...this.data, ...JSON.parse(fs.readFileSync(this.file, 'utf8')) };
      } catch (err) {
        const backup = `${this.file}.corrupt-${Date.now()}`;
        fs.copyFileSync(this.file, backup);
        console.error(`[store] could not parse ${this.file}, backed up to ${backup}:`, err.message);
      }
    }
  }

  get(collection, id) {
    return this.data[collection]?.[id];
  }

  set(collection, id, value) {
    if (!this.data[collection]) this.data[collection] = {};
    this.data[collection][id] = value;
    this.save();
    return value;
  }

  delete(collection, id) {
    if (this.data[collection]) delete this.data[collection][id];
    this.save();
  }

  all(collection) {
    return Object.values(this.data[collection] || {});
  }

  save() {
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 1500);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    fs.renameSync(tmp, this.file);
  }

  readSecret(name, factory) {
    const file = path.join(this.dir, name);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
    const value = factory();
    fs.writeFileSync(file, value, { mode: 0o600 });
    return value;
  }
}
