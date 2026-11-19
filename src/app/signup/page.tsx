'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, CheckCircle2, Lock, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { useAuth } from '@/components/Providers';
import { Field, Spinner } from '@/components/ui';
import { DEPARTMENTS, HOSTELS } from '@/lib/constants';

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [f, setF] = useState({ name: '', rollNumber: '', department: DEPARTMENTS[0] as string, hostel: 'BH-1' as string, gender: '', upiId: '' });
  const [confirm, setConfirm] = useState(false);
  const [card, setCard] = useState<string | null>(null);
  const [cardName, setCardName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<{ label: string; ok: boolean }[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cc_signup');
      if (raw) setSession(JSON.parse(raw)); else router.replace('/login');
    } catch { router.replace('/login'); }
  }, [router]);

  function onFile(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return setErr('ID card must be a PNG, JPG or WebP image');
    if (file.size > 1_200_000) return setErr('ID card image must be under 1.2 MB');
    const reader = new FileReader();
    reader.onload = () => { setCard(String(reader.result)); setCardName(file.name); setErr(''); };
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;
    setErr(''); setBusy(true);
    try {
      const r = await api<{ verification: { label: string; ok: boolean }[] }>('/api/auth/signup', {
        body: { signupToken: session.token, ...f, rollNumber: f.rollNumber.toUpperCase(), confirmGenderLock: confirm, idCardImage: card ?? undefined },
      });
      setSteps(r.verification);
      sessionStorage.removeItem('cc_signup');
      await refresh();
      setTimeout(() => router.replace('/dashboard'), 1600);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  if (!session) return <div className="p-10 text-center"><Spinner /></div>;
  if (steps) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-3 text-2xl font-extrabold">You&apos;re verified!</h1>
        <ul className="card mt-5 space-y-2 p-4 text-left text-sm">
          {steps.map((s) => <li key={s.label} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{s.label}</li>)}
          <li className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand-600" />Gender locked on your profile</li>
        </ul>
        <p className="mt-4 text-sm text-slate-500">Taking you to your dashboard…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Complete your student profile</h1>
      <p className="mt-1 text-sm text-slate-600">Email <b>{session.email}</b> verified. Add your Student ID details to finish verification.</p>
      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        <Field label="Full name (as on ID card)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Roll number" hint="e.g. IEC2024123"><input className="input font-mono uppercase" value={f.rollNumber} onChange={(e) => setF({ ...f, rollNumber: e.target.value.toUpperCase() })} required pattern="[A-Za-z]{3}\d{7}" maxLength={10} placeholder="IEC2024123" /></Field>
          <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Hostel"><select className="input" value={f.hostel} onChange={(e) => setF({ ...f, hostel: e.target.value })}>{HOSTELS.map((h) => <option key={h}>{h}</option>)}</select></Field>
          <Field label="UPI ID (optional)" hint="Used when you host a crew"><input className="input" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="name@okaxis" /></Field>
        </div>
        <fieldset>
          <legend className="label">Gender (as on ID)</legend>
          <div className="grid grid-cols-3 gap-2">
            {[['FEMALE', 'Female'], ['MALE', 'Male'], ['OTHER', 'Other']].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${f.gender === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700'}`}>
                <input type="radio" name="gender" className="sr-only" checked={f.gender === v} onChange={() => setF({ ...f, gender: v })} required />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <span className="label">Student ID card photo (optional)</span>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{cardName || 'Upload ID card image'}</button>
          {card && <img src={card} alt="ID card preview" className="mt-2 max-h-32 rounded-lg border" />}
        </div>
        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
          <span><Lock className="mr-1 inline h-3.5 w-3.5" />I understand my <b>gender is locked</b> after verification and cannot be edited later. This keeps girls-only and boys-only trips safe.</span>
        </label>
        {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !f.gender}>{busy && <Spinner className="!text-white" />}Verify & create account</button>
      </form>
    </div>
  );
}
