'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Plus, Search, TicketsPlane } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { PlaceSelect } from '@/components/PlaceSelect';
import { TripCard } from '@/components/TripCard';
import { EmptyState, ErrorBox, Modal, PageLoader, StatusPill } from '@/components/ui';
import { api, fmtDate, type Trip } from '@/lib/client';
import { useData, usePlaces } from '@/lib/useData';
import { GENDER_PREFS, GENDER_PREF_LABEL, MODES, MODE_LABEL } from '@/lib/constants';

type Journey = { id: string; title: string; segments: { id: string; origin: { name: string }; dest: { name: string }; date: string; windowStart: string; mode: string; status: string }[] };
const short = (n: string) => n.split(' (')[0];

function TripsInner() {
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = sp.get('tab') === 'mine' ? 'mine' : 'find';
  const places = usePlaces();
  const [f, setF] = useState({ origin: '', dest: '', date: '', mode: '', pref: '', from: '', to: '', luggage: '0' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const find = useData<{ trips: Trip[]; ranked: boolean }>(tab === 'find' ? `/api/trips/search?${qs}` : null);
  const mine = useData<{ active: Trip[]; upcoming: Trip[]; past: Trip[] }>(tab === 'mine' ? '/api/groups/mine' : null);
  const journeys = useData<{ journeys: Journey[] }>(tab === 'mine' ? '/api/journeys' : null);
  const [joining, setJoining] = useState<Trip | null>(null);
  const [lug, setLug] = useState(0);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const prefs = GENDER_PREFS.filter((p) => !user || p === 'MIXED' || (p === 'GIRLS_ONLY' && user.gender === 'FEMALE') || (p === 'BOYS_ONLY' && user.gender === 'MALE'));

  async function join() {
    if (!joining) return;
    setBusy(true);
    try {
      const r = await api<{ status: string; groupId: string }>(`/api/groups/${joining.id}/join`, { body: { luggage: lug } });
      toast.push('success', r.status === 'WAITLIST' ? 'Crew is full — you are on the waitlist.' : 'You joined the crew! 🎉');
      router.push(`/trips/${r.groupId}`);
    } catch (e) { toast.push('error', (e as Error).message); } finally { setBusy(false); setJoining(null); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900">Trips</h1>
        <Link href="/trips/new" className="btn-primary"><Plus className="h-4 w-4" />Plan a trip</Link>
      </div>
      <div className="inline-flex rounded-xl bg-slate-200/70 p-1 text-sm font-semibold" role="tablist">
        <Link role="tab" aria-selected={tab === 'find'} href="/trips" className={`rounded-lg px-4 py-1.5 ${tab === 'find' ? 'bg-white shadow' : 'text-slate-600'}`}>Find crews</Link>
        <Link role="tab" aria-selected={tab === 'mine'} href="/trips?tab=mine" className={`rounded-lg px-4 py-1.5 ${tab === 'mine' ? 'bg-white shadow' : 'text-slate-600'}`}>My trips</Link>
      </div>

      {tab === 'find' && (
        <>
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><span className="label">From</span><PlaceSelect places={places} value={f.origin} onChange={(v) => setF({ ...f, origin: v })} label="From" /></div>
            <div><span className="label">To</span><PlaceSelect places={places} value={f.dest} onChange={(v) => setF({ ...f, dest: v })} label="To" /></div>
            <div><span className="label">Date</span><input type="date" className="input" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
            <div><span className="label">Mode</span><select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option value="">Any</option>{MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select></div>
            <div><span className="label">Crew type</span><select className="input" value={f.pref} onChange={(e) => setF({ ...f, pref: e.target.value })}><option value="">Any I can join</option>{prefs.map((p) => <option key={p} value={p}>{GENDER_PREF_LABEL[p]}</option>)}</select></div>
            <div><span className="label">My window from</span><input type="time" className="input" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></div>
            <div><span className="label">My window to</span><input type="time" className="input" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} /></div>
            <div><span className="label">Luggage</span><select className="input" value={f.luggage} onChange={(e) => setF({ ...f, luggage: e.target.value })}>{[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n} bag{n === 1 ? '' : 's'}</option>)}</select></div>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-500"><Filter className="h-3.5 w-3.5" />{find.data?.ranked ? 'Ranked by smart match score (time overlap · cab fill & luggage · trust · hostel/night affinity).' : 'Add your time window to rank crews by smart match score.'}</p>
          {find.loading && !find.data && <PageLoader text="Searching crews…" />}
          {find.error && <ErrorBox message={find.error} onRetry={find.reload} />}
          {find.data && (find.data.trips.length === 0
            ? <EmptyState icon={<Search className="h-6 w-6" />} title="No matching crews" hint="Try a different date or start your own crew — others will find you." action={<Link href="/trips/new" className="btn-primary btn-sm mt-2">Start a crew</Link>} />
            : <div className="grid gap-3 md:grid-cols-2">{find.data.trips.map((t) => (
              <TripCard key={t.id} trip={t} action={
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">{t.seatsLeft > 0 ? `${t.seatsLeft} seat${t.seatsLeft > 1 ? 's' : ''} left` : `Full · ${t.waitlistCount} waitlisted`}</span>
                  <button className={t.seatsLeft > 0 ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => { setLug(Number(f.luggage)); setJoining(t); }}>{t.seatsLeft > 0 ? 'Join crew' : 'Join waitlist'}</button>
                </div>} />))}</div>)}
        </>
      )}

      {tab === 'mine' && (
        <div className="space-y-6">
          {(mine.loading || journeys.loading) && !mine.data && <PageLoader />}
          {mine.error && <ErrorBox message={mine.error} onRetry={mine.reload} />}
          {mine.data && (['active', 'upcoming', 'past'] as const).map((k) => mine.data![k].length > 0 && (
            <section key={k}><h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">{k === 'active' ? 'Live now' : k === 'upcoming' ? 'Upcoming' : 'Past'}</h2>
              <div className="grid gap-3 md:grid-cols-2">{mine.data![k].map((t) => <TripCard key={t.id} trip={t} compact={k === 'past'} />)}</div></section>))}
          {mine.data && !mine.data.active.length && !mine.data.upcoming.length && !mine.data.past.length && <EmptyState icon={<TicketsPlane className="h-6 w-6" />} title="No trips yet" action={<Link href="/trips/new" className="btn-primary btn-sm mt-2">Plan a trip</Link>} />}
          {journeys.data && journeys.data.journeys.length > 0 && (
            <section><h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-slate-500">My journeys (multi-leg plans)</h2>
              <div className="grid gap-3 md:grid-cols-2">{journeys.data.journeys.slice(0, 12).map((j) => (
                <Link key={j.id} href={`/journeys/${j.id}`} className="card block p-4 hover:shadow-lg"><div className="font-bold text-slate-900">{j.title}</div>
                  <ol className="mt-2 space-y-1 text-sm text-slate-600">{j.segments.map((s) => <li key={s.id} className="flex items-center gap-2"><span className="chip">{MODE_LABEL[s.mode as keyof typeof MODE_LABEL]}</span><span className="truncate">{short(s.origin.name)} → {short(s.dest.name)}</span><span className="ml-auto shrink-0 text-xs">{fmtDate(s.date)}</span><StatusPill status={s.status} /></li>)}</ol></Link>))}</div></section>)}
        </div>
      )}

      <Modal open={!!joining} onClose={() => setJoining(null)} title="Join this crew">
        {joining && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{short(joining.origin.name)} → {short(joining.dest.name)} · {fmtDate(joining.date)} · {joining.windowStart}–{joining.windowEnd}</p>
            <div><span className="label">How many bags?</span>
              <div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((n) => <button key={n} onClick={() => setLug(n)} className={`rounded-xl border py-2.5 text-sm font-bold ${lug === n ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300'}`}>{n}</button>)}</div>
              <p className="mt-1 text-xs text-slate-500">Trunk: {joining.bagsUsed}/{joining.bagCapacity >= 99 ? '∞' : joining.bagCapacity} used. Cabs are never over-booked on luggage — if it doesn’t fit you’ll be waitlisted.</p></div>
            <button className="btn-primary w-full" onClick={join} disabled={busy}>{joining.seatsLeft > 0 ? 'Confirm & join' : 'Join waitlist'}</button>
          </div>)}
      </Modal>
    </div>
  );
}

export default function TripsPage() {
  return <Suspense fallback={<PageLoader />}><TripsInner /></Suspense>;
}
