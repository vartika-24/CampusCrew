'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Lock, ShieldCheck, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { useAuth } from '@/components/Providers';
import { Field, Spinner } from '@/components/ui';

type Meta = { requireGovId: boolean; departments: string[]; hostels: string[]; idTypes: { value: string; label: string }[] };

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [f, setF] = useState({ name: '', rollNumber: '', department: '', hostel: '', upiId: '', idType: 'AADHAAR', gender: '' });
  const [confirm, setConfirm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cc_signup');
      if (raw) setSession(JSON.parse(raw)); else router.replace('/login');
    } catch { router.replace('/login'); }
    api<Meta>('/api/meta').then((m) => { setMeta(m); }).catch(() => undefined);
  }, [router]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function onFile(picked?: File) {
    if (!picked) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(picked.type)) return setErr('Upload a JPG, PNG or WebP photo of your ID');
    if (picked.size > 4 * 1024 * 1024) return setErr('The photo must be smaller than 4 MB');
    setErr(''); setFile(picked); setPreview(URL.createObjectURL(picked));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || (meta?.requireGovId && !file)) return;
    setErr(''); setBusy(true);
    try {
      const fd = new FormData();
      fd.set('signupToken', session.token);
      Object.entries({ ...f, rollNumber: f.rollNumber.toUpperCase(), confirmGenderLock: String(confirm) }).forEach(([k, v]) => { if (meta?.requireGovId ? k !== 'gender' : k !== 'idType') fd.set(k, v); });
      if (meta?.requireGovId && file) fd.set('idImage', file);
      const res = await fetch('/api/auth/signup', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      sessionStorage.removeItem('cc_signup');
      await refresh();
      setDone(data.user?.gender ?? 'OTHER');
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  if (!session || !meta) return <div className="p-10 text-center"><Spinner /></div>;
  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <BadgeCheck className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-3 text-2xl font-extrabold">{meta?.requireGovId ? 'You’re verified!' : 'Welcome aboard!'}</h1>
        <p className="mt-2 text-sm text-slate-600">{meta?.requireGovId ? <>We read your ID and set your profile gender to <b>{done === 'FEMALE' ? 'Female' : done === 'MALE' ? 'Male' : 'Other'}</b>. It is now locked. Your ID photo was not stored.</> : <>Your profile is ready. Plan your first trip next.</>}</p>
        <button className="btn-primary mt-6" onClick={() => router.replace('/dashboard')}>Continue</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">{meta.requireGovId ? 'Verify your identity' : 'Set up your profile'}</h1>
      <p className="mt-1 text-sm text-slate-600">{meta.requireGovId ? <>Email <b>{session.email}</b> verified. CampusCrew keeps girls-only and boys-only trips safe, so your gender is read directly from a government ID.</> : <>Signing in as <b>{session.email}</b>. Tell us a little about yourself — this is how crew mates will see you.</>}</p>
      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        <Field label={meta.requireGovId ? 'Full name (exactly as on your ID)' : 'Full name'}><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="College roll number" hint="e.g. IEC2024123"><input className="input font-mono uppercase" value={f.rollNumber} onChange={(e) => setF({ ...f, rollNumber: e.target.value.toUpperCase() })} required pattern="[A-Za-z]{3}\d{7}" maxLength={10} /></Field>
          <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} required><option value="">Select…</option>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Hostel"><select className="input" value={f.hostel} onChange={(e) => setF({ ...f, hostel: e.target.value })} required><option value="">Select…</option>{meta.hostels.map((h) => <option key={h}>{h}</option>)}</select></Field>
          <Field label="UPI ID (optional)" hint="Used when you host a crew"><input className="input" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="name@bank" /></Field>
        </div>
        {!meta.requireGovId && (
          <fieldset>
            <legend className="label">Gender (used for girls-only / boys-only crews)</legend>
            <div className="grid grid-cols-3 gap-2">
              {[['FEMALE', 'Female'], ['MALE', 'Male'], ['OTHER', 'Other']].map(([v, l]) => (
                <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${f.gender === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700'}`}>
                  <input type="radio" name="gender" className="sr-only" checked={f.gender === v} onChange={() => setF({ ...f, gender: v })} required />{l}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        {meta.requireGovId && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Field label="Government ID (required)">
            <select className="input" value={f.idType} onChange={(e) => setF({ ...f, idType: e.target.value })}>{meta.idTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </Field>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="id-file" />
          <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{file ? file.name : 'Upload a clear photo of your ID'}</button>
          {preview && <img src={preview} alt="ID preview" className="max-h-40 rounded-lg border" />}
          <p className="flex items-start gap-1.5 text-xs text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>Use the front side showing your name, photo and gender, flat and in good light. You may mask all but the last 4 digits of the ID number. The photo is read automatically and <b>not stored</b>.</span></p>
        </div>
        )}
        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
          <span><Lock className="mr-1 inline h-3.5 w-3.5" />{meta.requireGovId ? <>I understand the <b>gender printed on my ID</b> becomes my profile gender and is <b>locked</b> — it cannot be edited later.</> : <>I understand my <b>gender is locked</b> once my account is created and cannot be edited later.</>}</span>
        </label>
        {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || (meta.requireGovId ? !file : !f.gender)}>{busy && <Spinner className="!text-white" />}{busy ? (meta.requireGovId ? 'Reading your ID…' : 'Creating…') : meta.requireGovId ? 'Verify my ID & create account' : 'Create my profile'}</button>
      </form>
    </div>
  );
}
