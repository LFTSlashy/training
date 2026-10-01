import { create } from 'zustand';

export type ToastKind = 'info' | 'success' | 'error' | 'warn' | 'fill' | 'alert';
export interface Toast { id: number; kind: ToastKind; title: string; body?: string }

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id'>, ttl?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 1;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t, ttl = 5000) => {
    const id = seq++;
    set({ toasts: [...get().toasts.slice(-5), { ...t, id }] });
    setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

export const toast = (t: Omit<Toast, 'id'>, ttl?: number) => useToasts.getState().push(t, ttl);
