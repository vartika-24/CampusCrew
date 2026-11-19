'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { api, type Me } from '@/lib/client';

type Dues = { groupId: string; amount: number; route: string }[];
type AuthState = { user: Me | null; loading: boolean; dues: Dues; unread: number; demoMode: boolean; authMode: 'otp' | 'instant'; refresh: () => Promise<void>; logout: () => Promise<void> };
const AuthCtx = createContext<AuthState>({ user: null, loading: true, dues: [], unread: 0, demoMode: false, authMode: 'otp', refresh: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(AuthCtx);

type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<{ push: (kind: Toast['kind'], text: string) => void }>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<AuthState, 'refresh' | 'logout'>>({ user: null, loading: true, dues: [], unread: 0, demoMode: false, authMode: 'otp' });
  const [toasts, setToasts] = useState<Toast[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: Me | null; dues?: Dues; unread?: number; demoMode: boolean; authMode: 'otp' | 'instant' }>('/api/auth/me');
      setState({ user: r.user, loading: false, dues: r.dues ?? [], unread: r.unread ?? 0, demoMode: r.demoMode, authMode: r.authMode });
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    setState((s) => ({ ...s, user: null, dues: [], unread: 0 }));
    window.location.href = '/login';
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);

  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 4000);
  }, []);

  const auth = useMemo(() => ({ ...state, refresh, logout }), [state, refresh, logout]);
  const toastApi = useMemo(() => ({ push }), [push]);

  return (
    <AuthCtx.Provider value={auth}>
      <ToastCtx.Provider value={toastApi}>
        {children}
        <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4">
          {toasts.map((t) => (
            <div key={t.id} className={`pointer-events-auto flex max-w-md animate-slideup items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${t.kind === 'error' ? 'bg-red-600 text-white' : t.kind === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}>
              {t.kind === 'error' ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </AuthCtx.Provider>
  );
}
