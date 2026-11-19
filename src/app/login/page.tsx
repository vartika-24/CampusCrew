'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, KeyRound, Mail, Shield, Sparkles, UserRound } from 'lucide-react';
import { api, type Me } from '@/lib/client';
import { useAuth } from '@/components/Providers';
import { Spinner } from '@/components/ui';

const DEMOS = [
  { email: 'student.female@iiita.ac.in', name: 'Ananya Sharma', sub: 'B.Tech ECE · Female · Trust 96 · GH-2', tone: 'bg-pink-50 text-pink-700' },
  { email: 'student.male@iiita.ac.in', name: 'Rohan Verma', sub: 'B.Tech IT · Male · Trust 92 · BH-3', tone: 'bg-sky-50 text-sky-700' },
  { email: 'student.lowtrust@iiita.ac.in', name: 'Kabir Singh', sub: 'B.Tech ECE · Male · Trust 64 · 2 cancellations', tone: 'bg-amber-50 text-amber-700' },
  { email: 'admin@iiita.ac.in', name: 'Transport & Student Affairs', sub: 'Admin console · SOS & moderation', tone: 'bg-indigo-50 text-indigo-700', admin: true },
];

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '';
  const { refresh, demoMode } = useAuth();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function sendOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(''); setBusy('otp');
    try {
      const r = await api<{ devOtp?: string }>('/api/auth/request-otp', { body: { email } });
      setDevOtp(r.devOtp ?? null); setStep('otp'); setOtp('');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy('verify');
    try {
      const r = await api<{ needsOnboarding: boolean; signupToken?: string; user?: Me }>('/api/auth/verify-otp', { body: { email, otp } });
      if (r.needsOnboarding && r.signupToken) {
        sessionStorage.setItem('cc_signup', JSON.stringify({ token: r.signupToken, email }));
        router.push('/signup');
        return;
      }
      await refresh();
      router.replace(next || (r.user?.role === 'ADMIN' ? '/admin' : '/dashboard'));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  }

  async function demo(d: (typeof DEMOS)[number]) {
    setErr(''); setBusy(d.email);
    try {
      await api('/api/auth/demo', { body: { email: d.email } });
      await refresh();
      router.replace(next || (d.admin ? '/admin' : '/dashboard'));
    } catch (x) { setErr((x as Error).message); setBusy(null); }
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-2">
      <div>
        <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" />Back</Link>
        <h1 className="text-3xl font-extrabold text-slate-900">Sign in to CampusCrew</h1>
        <p className="mt-2 text-slate-600">We email a one-time code to your college address. New here? Verifying it starts a quick identity check.</p>

        <div className="card mt-6 p-5">
          {step === 'email' ? (
            <form onSubmit={sendOtp} className="space-y-4">
              <label className="block">
                <span className="label">College email</span>
                <div className="relative"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input className="input pl-9" type="email" inputMode="email" autoComplete="email" placeholder="you@iiita.ac.in" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <span className="mt-1 block text-xs text-slate-500">Only your college email (@iiita.ac.in) is accepted.</span>
              </label>
              {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
              <button className="btn-primary w-full" disabled={busy === 'otp'}>{busy === 'otp' ? <Spinner className="!text-white" /> : <KeyRound className="h-4 w-4" />}Send OTP</button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm text-slate-600">Enter the 6-digit OTP sent to <b>{email}</b></p>
              {devOtp && (
                <div className="flex items-center justify-between rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <span><Sparkles className="mr-1 inline h-4 w-4" />Dev mode OTP: <b className="font-mono text-base tracking-widest">{devOtp}</b></span>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setOtp(devOtp)}>Autofill</button>
                </div>
              )}
              <input className="input text-center font-mono text-xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required aria-label="6-digit OTP" />
              {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
              <button className="btn-primary w-full" disabled={otp.length !== 6 || busy === 'verify'}>{busy === 'verify' && <Spinner className="!text-white" />}Verify & continue</button>
              <div className="flex justify-between text-sm"><button type="button" className="font-semibold text-brand-700" onClick={() => { setStep('email'); setErr(''); }}>Change email</button><button type="button" className="font-semibold text-brand-700" onClick={() => sendOtp()}>Resend OTP</button></div>
            </form>
          )}
        </div>
      </div>

      {demoMode ? (
      <div>
        <div className="card p-5">
          <div className="mb-1 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-brand-700"><Sparkles className="h-4 w-4" />One-click demo login</div>
          <p className="mb-4 text-sm text-slate-500">Sample accounts with sample data — demo mode only.</p>
          <div className="space-y-2.5">
            {DEMOS.map((d) => (
              <button key={d.email} onClick={() => demo(d)} disabled={!!busy || !demoMode} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/40 disabled:opacity-60" data-testid={`demo-${d.email}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${d.tone}`}>{d.admin ? <Shield className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</span>
                <span className="min-w-0 flex-1"><span className="block font-bold text-slate-900">{d.name}</span><span className="block truncate text-xs text-slate-500">{d.sub}</span><span className="block truncate font-mono text-[11px] text-slate-400">{d.email}</span></span>
                {busy === d.email && <Spinner />}
              </button>
            ))}
          </div>
        </div>
      </div>
      ) : (
      <div className="card space-y-3 p-5 text-sm text-slate-600">
        <div className="font-extrabold text-slate-900">Who can join?</div>
        <p>Students with an <b>@iiita.ac.in</b> email. We email you a one-time code, then read a government ID (Aadhaar, passport, voter ID or driving licence) to set your verified gender, so girls-only and boys-only trips stay safe.</p>
        <p>The ID photo is read automatically and is never stored.</p>
      </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="p-10 text-center"><Spinner /></div>}><LoginInner /></Suspense>;
}
