'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EyeOff, Lock, Plane, Search, ShieldCheck, TrainFront, Users } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { PlaceSelect } from '@/components/PlaceSelect';
import { EmptyState, ErrorBox, PageLoader, TrustBadge, Avatar } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';
import { useData, usePlaces } from '@/lib/useData';

type Buddy = { entryId: string; firstName: string; department: string; year: number; trustScore: number; number: string; kind: string };
type Res = { optInRequired: boolean; buddies: Buddy[]; joined: boolean; transit: { kind: string; number: string } };
type Mine = { buddyVisible: boolean; entries: { id: string; kind: string; number: string; date: string }[] };

export default function BuddiesPage() {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const places = usePlaces();
  const mine = useData<Mine>('/api/buddies/mine');
  const meta = useData<{ today: string; settings: Record<string, string> }>('/api/meta');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState('');
  const [res, setRes] = useState<Res | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [c, setC] = useState({ departs: '', originId: '', stationId: '', destId: '', pref: 'MIXED' });

  if (!user || !meta.data) return <PageLoader />;
  const verified = user.idCardStatus === 'VERIFIED';
  const d = date || meta.data.settings.breakStart || meta.data.today;
  const visible = mine.data?.buddyVisible ?? user.buddyVisible;
  const campus = places.filter((p) => p.kind === 'CAMPUS');
  const stations = places.filter((p) => ['STATION', 'AIRPORT', 'BUS'].includes(p.kind));
  const isFlight = res?.transit.kind === 'FLIGHT';

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(''); setBusy(true);
    try { setRes(await api<Res>(`/api/buddies?number=${encodeURIComponent(number)}&date=${d}`)); } catch (x) { setErr((x as Error).message); setRes(null); } finally { setBusy(false); }
  }
  async function toggle(v: boolean) {
    try { await api('/api/buddies/visibility', { body: { visible: v } }); toast.push('success', v ? 'You are now visible to verified IIITA buddies' : 'You are hidden from buddy search'); mine.reload(); void refresh(); if (res) void search(); } catch (x) { toast.push('error', (x as Error).message); }
  }
  async function addEntry() {
    try { await api('/api/buddies', { body: { number, date: d } }); toast.push('success', 'Added to your travel list'); mine.reload(); void search(); } catch (x) { toast.push('error', (x as Error).message); }
  }
  async function coordinate() {
    setBusy(true);
    try {
      const r = await api<{ groupId: string; invited: number; window: string }>('/api/buddies/coordinate', { body: { number, date: d, departs: c.departs, originId: c.originId, stationId: c.stationId, destId: c.destId || undefined, genderPref: c.pref } });
      toast.push('success', `Cab crew created (${r.window}). ${r.invited} buddy invite(s) sent.`);
      router.push(`/trips/${r.groupId}`);
    } catch (x) { toast.push('error', (x as Error).message); } finally { setBusy(false); }
  }

  const prefs = [['MIXED', 'Mixed'], ...(verified && user.gender === 'FEMALE' ? [['GIRLS_ONLY', 'Girls only']] : []), ...(verified && user.gender === 'MALE' ? [['BOYS_ONLY', 'Boys only']] : [])];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Same-train / same-flight buddies</h1><p className="text-sm text-slate-600">Find verified IIITA students on your train or flight and share the cab to the station.</p></div>
      {!verified && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Buddy features unlock once Student Affairs approves your ID.</div>}

      <div className="card space-y-3 p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1 text-sm text-slate-600"><b className="text-slate-900">Privacy-first (DPDP Act aligned).</b> Strictly opt-in. Buddies only see your <b>first name, department, year, trust score and train/flight number</b> — never coach/seat, phone or home address.</div>
          <label className="relative inline-flex cursor-pointer items-center" aria-label="Show me to buddies">
            <input type="checkbox" className="peer sr-only" checked={visible} disabled={!verified} onChange={(e) => toggle(e.target.checked)} data-testid="buddy-toggle" />
            <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-emerald-500 peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300" />
            <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
          </label>
        </div>
        <div className="text-xs font-semibold text-slate-500">{visible ? '✔ Visible to verified students of your college' : '🔒 Hidden — turn on to see and be seen'}</div>
      </div>

      <form onSubmit={search} className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
        <div><span className="label">Train or flight number</span><input className="input font-mono uppercase" value={number} onChange={(e) => setNumber(e.target.value.toUpperCase())} placeholder="e.g. 12301 or 6E-2134" required aria-label="Train or flight number" /></div>
        <div><span className="label">Travel date</span><input type="date" className="input" min={meta.data.today} value={d} onChange={(e) => setDate(e.target.value)} required /></div>
        <div className="flex items-end"><button className="btn-primary w-full" disabled={busy || !number || !verified}><Search className="h-4 w-4" />Find buddies</button></div>
      </form>
      {err && <ErrorBox message={err} />}

      {res && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-bold text-slate-900">{isFlight ? 'Flight' : 'Train'} {res.transit.number}</span><span className="text-slate-400">· {fmtDate(d)}</span></div>
          {res.optInRequired ? (
            <EmptyState icon={<EyeOff className="h-6 w-6" />} title="Opt in to see buddies" hint="Buddy discovery is reciprocal: turn on visibility above to see (and be seen by) verified students on this train or flight." action={<button className="btn-primary btn-sm mt-2" onClick={() => toggle(true)}>Turn on visibility</button>} />
          ) : res.buddies.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No visible buddies yet" hint="Add this journey to your list so others can find you." action={!res.joined ? <button className="btn-secondary btn-sm mt-2" onClick={addEntry}>Add me to {res.transit.number}</button> : <span className="chip mt-2">You are listed for this journey</span>} />
          ) : (
            <ul className="space-y-2">{res.buddies.map((b) => (
              <li key={b.entryId} className="card flex items-center gap-3 p-3"><Avatar name={b.firstName} /><div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{b.firstName}</div><div className="text-xs text-slate-500">{b.department} · Year {b.year}</div></div><span className="chip">{b.kind === 'FLIGHT' ? <Plane className="h-3 w-3" /> : <TrainFront className="h-3 w-3" />}{b.number}</span><TrustBadge score={b.trustScore} /></li>))}</ul>
          )}

          {!res.optInRequired && (
            <div className="card space-y-3 border-brand-200 bg-brand-50/40 p-4">
              <h3 className="flex items-center gap-2 font-bold text-brand-900"><Lock className="h-4 w-4" />Coordinate cab to the {isFlight ? 'airport' : 'station'} together</h3>
              <p className="text-sm text-slate-600">Creates a linked Leg-1 cab crew from campus, timed from your {isFlight ? 'flight' : 'train'}&apos;s departure, and invites the buddies above.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><span className="label">Campus pickup point</span><PlaceSelect places={campus} value={c.originId} onChange={(v) => setC({ ...c, originId: v })} label="Pickup point" /></div>
                <div><span className="label">{isFlight ? 'Airport' : 'Station'}</span><PlaceSelect places={stations} value={c.stationId} onChange={(v) => setC({ ...c, stationId: v })} label="Station" /></div>
                <div><span className="label">Departure time (from your ticket)</span><input type="time" className="input" value={c.departs} onChange={(e) => setC({ ...c, departs: e.target.value })} required /></div>
                <div><span className="label">Crew type</span><select className="input" value={c.pref} onChange={(e) => setC({ ...c, pref: e.target.value })}>{prefs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div className="sm:col-span-2"><span className="label">Final destination (optional — adds your train/flight as Leg 2)</span><PlaceSelect places={places.filter((p) => p.kind !== 'CAMPUS')} value={c.destId} onChange={(v) => setC({ ...c, destId: v })} label="Destination" /></div>
              </div>
              <div className="flex flex-wrap gap-2"><button className="btn-primary" disabled={busy || !c.departs || !c.originId || !c.stationId} onClick={coordinate} data-testid="coordinate-cab">Coordinate Cab to {isFlight ? 'Airport' : 'Station'} Together</button>{!res.joined && <button className="btn-secondary" onClick={addEntry}>Just add me to the list</button>}</div>
            </div>
          )}
        </div>
      )}

      {mine.data && mine.data.entries.length > 0 && (
        <div className="card p-4"><h3 className="mb-2 font-bold text-slate-900">My listed journeys</h3>
          <ul className="space-y-1.5 text-sm">{mine.data.entries.map((e) => <li key={e.id} className="flex items-center justify-between"><span><span className="font-mono font-bold">{e.number}</span> <span className="text-slate-500">{fmtDate(e.date)}</span></span><button className="btn-ghost btn-sm text-red-600" onClick={async () => { await api(`/api/buddies?id=${e.id}`, { method: 'DELETE' }); mine.reload(); }}>Remove</button></li>)}</ul></div>
      )}
    </div>
  );
}
