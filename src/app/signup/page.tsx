'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Lock, ShieldCheck, Upload } from 'lucide-react';
import { api } from '@/lib/client';
import { useAuth } from '@/components/Providers';
import { Field, Spinner } from '@/components/ui';

type Meta = { departments: string[]; hostels: string[]; idTypes: { value: string; label: string }[] };

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [session, setSession] = useState<{ token: string; email: string } | null>(null);
  const [f, setF] = useState({ name: '', rollNumber: '', department: '', hostel: '', gender: '', upiId: '', idType: 'AADHAAR' });
  const [confirm, setConfirm] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('cc_signup');
      if (raw) setSession(JSON.parse(raw)); else router.replace('/login');
    } catch { router.replace('/login'); }
    api<Meta>('/api/meta').then((m) => { setMeta(m); setF((x) => ({ ...x, department: m.departments[0] ?? '', hostel: m.hostels[0] ?? '' })); }).catch(() => undefined);
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
    if (!session || !file) return;
    setErr(''); setBusy(true);
    try {
      const fd = new FormData();
      fd.set('signupToken', session.token);
      Object.entries({ ...f, rollNumber: f.rollNumber.toUpperCase(), confirmGenderLock: String(confirm) }).forEach(([k, v]) => fd.set(k, v));
      fd.set('idImage', file);
      const res = await fetch('/api/auth/signup', { method: 'POST', body: fd, credentials: 'same-origin' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Signup failed');
      sessionStorage.removeItem('cc_signup');
      await refresh();
      setDone(true);
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }

  if (!session || !meta) return <div className="p-10 text-center"><Spinner /></div>;
  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Clock className="mx-auto h-14 w-14 text-amber-500" />
        <h1 className="mt-3 text-2xl font-extrabold">ID submitted for review</h1>
        <p className="mt-2 text-sm text-slate-600">Student Affairs will check your government ID against your name and gender. You&apos;ll get an email at <b>{session.email}</b> as soon as it&apos;s approved. Until then you can look around but can&apos;t book trips.</p>
        <button className="btn-primary mt-6" onClick={() => router.replace('/dashboard')}>Continue</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-extrabold text-slate-900">Verify your identity</h1>
      <p className="mt-1 text-sm text-slate-600">Email <b>{session.email}</b> verified. CampusCrew keeps girls-only and boys-only trips safe, so every student is checked against a government ID.</p>
      <form onSubmit={submit} className="card mt-5 space-y-4 p-5">
        <Field label="Full name (exactly as on your ID)"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} maxLength={60} autoComplete="name" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="College roll number" hint="e.g. IEC2024123"><input className="input font-mono uppercase" value={f.rollNumber} onChange={(e) => setF({ ...f, rollNumber: e.target.value.toUpperCase() })} required pattern="[A-Za-z]{3}\d{7}" maxLength={10} /></Field>
          <Field label="Department"><select className="input" value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} required>{meta.departments.map((d) => <option key={d}>{d}</option>)}</select></Field>
          <Field label="Hostel"><select className="input" value={f.hostel} onChange={(e) => setF({ ...f, hostel: e.target.value })} required>{meta.hostels.map((h) => <option key={h}>{h}</option>)}</select></Field>
          <Field label="UPI ID (optional)" hint="Used when you host a crew"><input className="input" value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="name@bank" /></Field>
        </div>
        <fieldset>
          <legend className="label">Gender (as printed on your ID)</legend>
          <div className="grid grid-cols-3 gap-2">
            {[['FEMALE', 'Female'], ['MALE', 'Male'], ['OTHER', 'Other']].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-semibold ${f.gender === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700'}`}>
                <input type="radio" name="gender" className="sr-only" checked={f.gender === v} onChange={() => setF({ ...f, gender: v })} required />{l}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Field label="Government ID (required)">
            <select className="input" value={f.idType} onChange={(e) => setF({ ...f, idType: e.target.value })}>{meta.idTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
          </Field>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="id-file" />
          <button type="button" className="btn-secondary w-full" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" />{file ? file.name : 'Upload a clear photo of your ID'}</button>
          {preview && <img src={preview} alt="ID preview" className="max-h-40 rounded-lg border" />}
          <p className="flex items-start gap-1.5 text-xs text-slate-600"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span>Name, photo and gender must be readable. You may mask all but the last 4 digits of the ID number. Only Student Affairs can view it, and it is <b>permanently deleted</b> once reviewed.</span></p>
        </div>

        <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
          <span><Lock className="mr-1 inline h-3.5 w-3.5" />I confirm the details match my ID. My <b>gender is locked</b> after approval and cannot be edited later.</span>
        </label>
        {err && <p role="alert" className="text-sm font-medium text-red-600">{err}</p>}
        <button className="btn-primary w-full" disabled={busy || !f.gender || !file}>{busy && <Spinner className="!text-white" />}Submit for verification</button>
      </form>
    </div>
  );
}
