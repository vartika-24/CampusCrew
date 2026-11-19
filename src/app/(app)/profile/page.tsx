'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Clock, Lock, ShieldCheck, Upload } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { ErrorBox, Field, PageLoader, TrustBadge } from '@/components/ui';
import { api, type Me } from '@/lib/client';
import { useData } from '@/lib/useData';

type Prof = { user: Me; breakdown: { base: number; rides: number; rating: number; punctuality: number; lateCancelPenalty: number; cancelPenalty: number; reportPenalty: number; adminAdjust: number; total: number }; punctualCount: number; ratingCount: number };

export default function ProfilePage() {
  const { refresh } = useAuth();
  const p = useData<Prof>('/api/profile');
  const meta = useData<{ hostels: string[]; idTypes: { value: string; label: string }[] }>('/api/meta');
  const [idf, setIdf] = useState({ idType: 'AADHAAR', name: '' });
  const [idFile, setIdFile] = useState<File | null>(null);
  const toast = useToast();
  const [upi, setUpi] = useState('');
  const [hostel, setHostel] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (p.data) { setUpi(p.data.user.upiId ?? ''); setHostel(p.data.user.hostel ?? ''); } }, [p.data]);

  if (p.loading && !p.data) return <PageLoader />;
  if (p.error || !p.data) return <ErrorBox message={p.error || 'Failed'} onRetry={p.reload} />;
  const { user: u, breakdown: b } = p.data;

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api('/api/profile', { method: 'PATCH', body: { upiId: upi, hostel } }); toast.push('success', 'Profile saved'); p.reload(); void refresh(); } catch (x) { toast.push('error', (x as Error).message); } finally { setBusy(false); }
  }

  const rows: [string, number, string][] = [
    ['Verified student (email + ID)', b.base, 'Base'], ['Completed rides', b.rides, `${u.completedRides} × +5 (max +25)`], ['Peer rating', b.rating, u.ratingAvg ? `avg ${u.ratingAvg}/5` : 'no ratings yet'],
    ['Punctuality confirmations', b.punctuality, `${p.data.punctualCount} × +2 (max +10)`], ['Late cancellations', -b.lateCancelPenalty, `${u.lateCancels} × −15`], ['Other cancellations', -b.cancelPenalty, '−5 each'],
    ['Unresolved reports', -b.reportPenalty, '−25 each'], ['Moderation adjustments', b.adminAdjust, 'Student Affairs'],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-extrabold text-slate-900">Profile & trust</h1>
      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-2xl font-extrabold text-white">{u.name[0]}</div>
          <div className="min-w-0 flex-1"><div className="text-lg font-extrabold text-slate-900">{u.name}</div><div className="text-sm text-slate-600">{u.email}</div><div className="mt-1 flex flex-wrap gap-1.5"><span className="badge bg-emerald-50 text-emerald-700"><BadgeCheck className="h-3 w-3" />ID {u.idCardStatus.toLowerCase()}</span><span className="chip">{u.rollNumber}</span><span className="chip">{u.department} · Year {u.year}</span></div></div>
          <TrustBadge score={u.trustScore} size="lg" /></div>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><Lock className="h-4 w-4 shrink-0 text-brand-600" /><span>Gender: <b>{u.gender === 'FEMALE' ? 'Female' : u.gender === 'MALE' ? 'Male' : 'Other'}</b> {u.genderLocked ? <span className="chip ml-1" data-testid="gender-locked">Locked</span> : <span className="chip ml-1">Unverified</span>} — {u.genderLocked ? 'read from your government ID and cannot be edited, keeping gendered trips safe.' : 'locks once your ID is verified. Until then you only see mixed crews.'}</span></div>
      </div>

      {u.role !== 'ADMIN' && u.idCardStatus !== 'VERIFIED' && (
        <div className="card space-y-3 border-amber-300 p-5" data-testid="verification-card">
          <h2 className="flex items-center gap-2 font-bold text-slate-900"><Clock className="h-5 w-5 text-amber-600" />Verify your government ID</h2>
          <p className="text-sm text-slate-600">Upload the front of your Aadhaar, passport, voter ID or driving licence. Your gender is read from it automatically and locked; the photo is not stored.</p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => { e.preventDefault(); if (!idFile) return; setBusy(true); try { const fd = new FormData(); fd.set('idType', idf.idType); fd.set('idImage', idFile); if (idf.name) fd.set('name', idf.name); const r = await fetch('/api/profile/id', { method: 'POST', body: fd }); const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Verification failed'); toast.push('success', 'Verified!'); setIdFile(null); p.reload(); void refresh(); } catch (x) { toast.push('error', (x as Error).message); } finally { setBusy(false); } }}>
            <Field label="ID type"><select className="input" value={idf.idType} onChange={(e) => setIdf({ ...idf, idType: e.target.value })}>{(meta.data?.idTypes ?? []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
            <Field label="Name on ID"><input className="input" value={idf.name} onChange={(e) => setIdf({ ...idf, name: e.target.value })} placeholder={u.name} /></Field>
            <div className="sm:col-span-2"><label className="btn-secondary w-full cursor-pointer"><Upload className="h-4 w-4" />{idFile ? idFile.name : 'Choose ID photo'}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} /></label></div>
            <button className="btn-primary sm:col-span-2" disabled={busy || !idFile}>{busy ? 'Reading your ID…' : 'Verify my ID'}</button>
          </form>
        </div>
      )}

      <div className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-brand-600" />Trust score breakdown</h2>
        <p className="mb-3 text-xs text-slate-500">Below 70: deprioritised in matching and blocked from rides departing after 21:00.</p>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${u.trustScore >= 85 ? 'bg-emerald-500' : u.trustScore >= 70 ? 'bg-sky-500' : u.trustScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${u.trustScore}%` }} /></div>
        <ul className="mt-3 divide-y divide-slate-100 text-sm">{rows.map(([l, v, n]) => <li key={l} className="flex items-center justify-between py-2"><span><span className="font-medium text-slate-800">{l}</span> <span className="text-xs text-slate-400">{n}</span></span><span className={`font-mono font-bold ${v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-600' : 'text-slate-400'}`}>{v > 0 ? `+${v}` : v}</span></li>)}
          <li className="flex items-center justify-between py-2 font-extrabold"><span>Total</span><span className="text-lg">{b.total}</span></li></ul>
      </div>

      <form onSubmit={save} className="card space-y-4 p-5">
        <h2 className="font-bold text-slate-900">Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hostel"><select className="input" value={hostel} onChange={(e) => setHostel(e.target.value)}>{(meta.data?.hostels ?? []).map((h) => <option key={h}>{h}</option>)}</select></Field>
          <Field label="UPI ID" hint="Riders pay you here when you host"><input className="input" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@okaxis" /></Field>
        </div>
        <button className="btn-primary" disabled={busy}>Save changes</button>
      </form>
    </div>
  );
}
