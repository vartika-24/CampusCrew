'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './client';

/** Small data hook: fetch on mount / dependency change, with optional polling. */
export function useData<T>(url: string | null, opts: { poll?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!url);
  const alive = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!url) return;
    if (!silent) setLoading(true);
    try { const d = await api<T>(url); if (alive.current) { setData(d); setError(''); } }
    catch (e) { if (alive.current) setError((e as Error).message); }
    finally { if (alive.current && !silent) setLoading(false); }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    void load();
    const id = opts.poll ? setInterval(() => void load(true), opts.poll) : undefined;
    return () => { alive.current = false; if (id) clearInterval(id); };
  }, [load, opts.poll]);

  return { data, error, loading, reload: () => load(), silentReload: () => load(true), setData };
}

export function usePlaces() {
  const { data } = useData<{ places: import('./client').Place[] }>('/api/places');
  return data?.places ?? [];
}
