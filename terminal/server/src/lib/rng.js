// Deterministic pseudo-random utilities (seeded so histories are reproducible).

export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed);
    this._spare = null;
  }
  uniform(a = 0, b = 1) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return Math.floor(this.uniform(a, b + 1));
  }
  normal() {
    if (this._spare !== null) {
      const s = this._spare;
      this._spare = null;
      return s;
    }
    let u, v, s;
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const m = Math.sqrt((-2 * Math.log(s)) / s);
    this._spare = v * m;
    return u * m;
  }
  // Student-t-ish fat tails: normal scaled by occasional volatility bursts.
  fatNormal(df = 4) {
    let chi = 0;
    for (let i = 0; i < df; i++) {
      const z = this.normal();
      chi += z * z;
    }
    return this.normal() / Math.sqrt(chi / df) * Math.sqrt((df - 2) / df);
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  chance(p) {
    return this.next() < p;
  }
}

/** Stateless noise in [0,1) for a key — used for slowly evolving order book sizes. */
export function noise(key) {
  return mulberry32(hashString(key))();
}
