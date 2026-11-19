'use client';

import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, Loader2, Moon, ShieldCheck, X } from 'lucide-react';
import { GENDER_PREF_LABEL, MODE_LABEL, type GenderPref, type Mode } from '@/lib/constants';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-brand-600 ${className}`} aria-label="Loading" />;
}

export function PageLoader({ text = 'Loading…' }: { text?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Spinner />{text}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button onClick={onRetry} className="btn-secondary btn-sm">Retry</button>}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="rounded-full bg-brand-50 p-3 text-brand-600">{icon}</div>}
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div onClick={(e) => e.stopPropagation()} className={`max-h-[92vh] w-full animate-slideup overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'brand', icon }: { label: string; value: ReactNode; sub?: string; tone?: 'brand' | 'eco' | 'warn' | 'danger'; icon?: ReactNode }) {
  const t = { brand: 'bg-brand-50 text-brand-700', eco: 'bg-emerald-50 text-emerald-700', warn: 'bg-amber-50 text-amber-700', danger: 'bg-red-50 text-red-700' }[tone];
  return (
    <div className="card flex items-center gap-3 p-4">
      {icon && <div className={`rounded-xl p-2.5 ${t}`}>{icon}</div>}
      <div className="min-w-0">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-extrabold leading-tight text-slate-900">{value}</div>
        {sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function TrustBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const tone = score >= 85 ? 'bg-emerald-100 text-emerald-800' : score >= 70 ? 'bg-sky-100 text-sky-800' : score >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800';
  return (
    <span className={`badge ${tone} ${size === 'lg' ? 'px-3 py-1 text-sm' : ''}`} title={`Trust score ${score}/100`}>
      <ShieldCheck className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />{score}
    </span>
  );
}

export function VerifiedBadge({ label = 'Verified' }: { label?: string }) {
  return <span className="badge bg-emerald-50 text-emerald-700"><BadgeCheck className="h-3 w-3" />{label}</span>;
}

export function GenderBadge({ pref }: { pref: string }) {
  const map: Record<string, string> = { GIRLS_ONLY: 'bg-pink-100 text-pink-800', BOYS_ONLY: 'bg-sky-100 text-sky-800', MIXED: 'bg-slate-100 text-slate-700' };
  return <span className={`badge ${map[pref] ?? map.MIXED}`}>{GENDER_PREF_LABEL[pref as GenderPref] ?? pref}</span>;
}

export function ModeBadge({ mode }: { mode: string }) {
  return <span className="badge bg-brand-50 text-brand-700">{MODE_LABEL[mode as Mode] ?? mode}</span>;
}

export function NightBadge() {
  return <span className="badge bg-indigo-900 text-indigo-100"><Moon className="h-3 w-3" />Night Safety Mode</span>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-sky-100 text-sky-800', CONFIRMED: 'bg-indigo-100 text-indigo-800', IN_PROGRESS: 'bg-emerald-100 text-emerald-800 ',
    COMPLETED: 'bg-slate-100 text-slate-700', CANCELLED: 'bg-red-100 text-red-700', PLANNED: 'bg-slate-100 text-slate-700',
    MATCHED: 'bg-emerald-100 text-emerald-800', WAITLISTED: 'bg-amber-100 text-amber-800', WAITLIST: 'bg-amber-100 text-amber-800', JOINED: 'bg-emerald-100 text-emerald-800',
  };
  const label = status === 'IN_PROGRESS' ? 'LIVE' : status;
  return <span className={`badge ${map[status] ?? 'bg-slate-100 text-slate-700'}`}>{status === 'IN_PROGRESS' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />}{label.charAt(0) + label.slice(1).toLowerCase()}</span>;
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hues = [250, 160, 20, 200, 330, 40, 280];
  const hue = hues[(name.charCodeAt(0) + name.length) % hues.length];
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: `hsl(${hue} 55% 45%)`, fontSize: size * 0.4 }} aria-hidden>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function SectionTitle({ title, action, sub }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">{title}</h2>{sub && <p className="text-sm text-slate-500">{sub}</p>}</div>
      {action}
    </div>
  );
}
