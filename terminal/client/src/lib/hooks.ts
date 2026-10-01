import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Fetch JSON from the API; optional polling interval. */
export function useApi<T>(url: string | null, intervalMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlRef = useRef(url);
  urlRef.current = url;

  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const d = await api.get<T>(url);
      if (urlRef.current === url) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (urlRef.current === url) setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setData(null);
    load();
    if (!intervalMs) return;
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  return { data, error, loading, reload: load, setData };
}

export function useInterval(fn: () => void, ms: number) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useInterval(() => setNow(Date.now()), ms);
  return now;
}

export type SortDir = 'asc' | 'desc';
export function useSort<T>(rows: T[], initialKey: keyof T | null = null, initialDir: SortDir = 'desc') {
  const [key, setKey] = useState<keyof T | null>(initialKey);
  const [dir, setDir] = useState<SortDir>(initialDir);
  const sorted = key
    ? [...rows].sort((a, b) => {
        const va = a[key] as unknown, vb = b[key] as unknown;
        if (va === vb) return 0;
        if (va === null || va === undefined) return 1;
        if (vb === null || vb === undefined) return -1;
        const c = typeof va === 'string' ? (va as string).localeCompare(vb as string) : (va as number) - (vb as number);
        return dir === 'asc' ? c : -c;
      })
    : rows;
  const toggle = (k: keyof T) => {
    if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setKey(k); setDir('desc'); }
  };
  return { sorted, key, dir, toggle };
}
