import crypto from 'node:crypto';
import { signJwt, verifyJwt, hashPassword, verifyPassword } from './lib/jwt.js';

export class Auth {
  constructor(store, { secret, ttlSec }) {
    this.store = store;
    this.secret = secret;
    this.ttlSec = ttlSec;
  }

  findByUsername(username) {
    const u = String(username || '').trim().toLowerCase();
    return this.store.all('users').find((x) => x.username === u);
  }

  register(username, password, displayName) {
    const u = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(u)) throw httpError(400, 'Username must be 3-32 chars: letters, digits, _ . -');
    if (typeof password !== 'string' || password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
    if (this.findByUsername(u)) throw httpError(409, 'Username already taken');
    const user = {
      id: `U${crypto.randomBytes(6).toString('hex')}`,
      username: u,
      displayName: String(displayName || username).slice(0, 48),
      passwordHash: hashPassword(password),
      createdAt: Date.now(),
    };
    this.store.set('users', user.id, user);
    return user;
  }

  login(username, password) {
    const user = this.findByUsername(username);
    if (!user || !verifyPassword(String(password || ''), user.passwordHash)) throw httpError(401, 'Invalid username or password');
    return user;
  }

  token(user) {
    return signJwt({ sub: user.id, name: user.username }, this.secret, this.ttlSec);
  }

  verify(token) {
    const payload = verifyJwt(token, this.secret);
    if (!payload) return null;
    return this.store.get('users', payload.sub) || null;
  }

  middleware() {
    return (req, res, next) => {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      const user = token && this.verify(token);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      req.user = user;
      next();
    };
  }
}

export const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, createdAt: u.createdAt });

export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}
