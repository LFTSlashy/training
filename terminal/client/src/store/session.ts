import { create } from 'zustand';
import { api, tokenStore, setUnauthorizedHandler } from '../lib/api';
import type { User } from '../lib/types';

interface SessionState {
  user: User | null;
  ready: boolean;
  init: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  init: async () => {
    setUnauthorizedHandler(() => {
      tokenStore.set(null);
      set({ user: null });
    });
    if (!tokenStore.get()) return set({ ready: true });
    try {
      const { user } = await api.get<{ user: User }>('/auth/me');
      set({ user, ready: true });
    } catch {
      tokenStore.set(null);
      set({ user: null, ready: true });
    }
  },
  login: async (username, password) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
    tokenStore.set(res.token);
    set({ user: res.user });
  },
  register: async (username, password, displayName) => {
    const res = await api.post<{ token: string; user: User }>('/auth/register', { username, password, displayName });
    tokenStore.set(res.token);
    set({ user: res.user });
  },
  logout: () => {
    tokenStore.set(null);
    set({ user: null });
  },
}));
