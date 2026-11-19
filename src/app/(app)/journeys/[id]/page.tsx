'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { useToast } from '@/components/Providers';
import { TripCard } from '@/components/TripCard';
import { EmptyState, ErrorBox, GenderBadge, ModeBadge, PageLoader, StatusPill } from '@/components/ui';
import { api, fmtDate, type Trip } from '@/lib/client';
import { useData } from '@/lib/useData';

type Seg = { id: string; seq: number; origin: { name: string }; dest: { name: string }; date: string; windowStart: string; windowEnd: string; mode: string; luggage: number; genderPref: string; trainNumber: string | null; flightNumber: string | null; status: string; groupId: string | null; group: { id: string; status: string; riders: number; seats: number; delayMins: number } | null };
type J = { id: string; title: string; segments: Seg[] };
const short = (n: string) => n.split(' (')[0];

export default function JourneyPage({ params }: { params: { id: string } }) {
  const j = useData<{ journey: J }>(`/api/journeys/${params.id}`);
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [matches, setMatches] = useState<Trip[] | null>(null);
  const [loadingM, setLoadingM] = useState(false);

  async function find(id: string) {
    setOpen(id); setMatches(null); setLoadingM(true);
    try { setMatches((await api<{ matches: Trip[] }>(`/api/segments/${id}/matches`)).matches); }
    catch (e) { toast.push('error', (e as Error).message); } finally { setLoadingM(false); }
  }
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.push('success', ok); setOpen(null); j.reload(); } catch (e) { toast.push('error', (e as Error).message); }
  };

  if (j.loading && !j.data) return <PageLoader />;
  if (j.error) return <ErrorBox message={j.error} onRetry={j.reload} />;
  const journey = j.data!.journey;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><Link href="/trips?tab=mine" className="text-sm font-semibold text-brand-700">← My trips</Link><h1 className="mt-1 text-2xl font-extrabold text-slate-900">{journey.title}</h1><p className="text-sm text-slate-600">{journey.segments.length} leg{journey.segments.length > 1 ? 's' : ''} · each leg is matched independently</p></div>
      <ol className="space-y-3">
        {journey.segments.map((s, i) => (
          <li key={s.id} className="card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5"><ModeBadge mode={s.mode} /><GenderBadge pref={s.genderPref} /><StatusPill status={s.status} />{s.group?.delayMins ? <span className="badge bg-amber-100 text-amber-800">Delayed {s.group.delayMins}m</span> : null}</div>
                <div className="mt-1.5 flex items-center gap-2 font-bold text-slate-900"><span className="truncate">{short(s.origin.name)}</span><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{short(s.dest.name)}</span></div>
                <div className="text-sm text-slate-600">{fmtDate(s.date)} · {s.windowStart}–{s.windowEnd} · {s.luggage} bag{s.luggage === 1 ? '' : 's'}{s.trainNumber ? ` · Train ${s.trainNumber}` : ''}{s.flightNumber ? ` · Flight ${s.flightNumber}` : ''}</div>
                {s.group && <div className="mt-1 text-xs text-slate-500">{s.group.riders}/{s.group.seats} riders in crew</div>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              {s.groupId && ['MATCHED', 'WAITLISTED'].includes(s.status) && <Link href={`/trips/${s.groupId}`} className="btn-primary btn-sm">Open trip room</Link>}
              {['PLANNED', 'CANCELLED'].includes(s.status) && (<>
                <button className="btn-primary btn-sm" onClick={() => find(s.id)}>Find crew</button>
                <button className="btn-secondary btn-sm" onClick={() => act(() => api(`/api/segments/${s.id}/auto`, { body: {} }), 'Leg matched')}><Sparkles className="h-3.5 w-3.5" />Auto-match</button>
                <button className="btn-secondary btn-sm" onClick={() => act(() => api(`/api/segments/${s.id}/host`, { body: {} }), 'You are now hosting this leg')}>Host a new crew</button>
              </>)}
              {s.status === 'PLANNED' && <button className="btn-ghost btn-sm text-red-600" onClick={() => act(() => api(`/api/segments/${s.id}/cancel`, { body: {} }), 'Leg cancelled')}><X className="h-3.5 w-3.5" />Cancel leg</button>}
            </div>
            {open === s.id && (
              <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                {loadingM && <PageLoader text="Scoring candidate crews…" />}
                {matches && matches.length === 0 && <EmptyState title="No crews match yet" hint="Host a new crew — others heading the same way will be matched to you." />}
                {matches?.map((m) => (
                  <TripCard key={m.id} trip={m} action={
                    <div className="flex items-center justify-between gap-2"><span className="text-xs text-slate-500">{m.score?.eligible ? 'Eligible' : m.score?.blockers.join(' · ')}</span>
                      <button className="btn-primary btn-sm" disabled={!m.score?.eligible && !m.score?.blockers.every((b) => b === 'No seats left' || b === 'Not enough luggage space')} onClick={() => act(() => api(`/api/segments/${s.id}/join`, { body: { groupId: m.id } }), m.seatsLeft > 0 ? 'Joined crew' : 'Added to waitlist')}>{m.seatsLeft > 0 && m.score?.eligible ? 'Join' : 'Join waitlist'}</button></div>} />))}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
