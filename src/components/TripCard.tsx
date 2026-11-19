'use client';

import Link from 'next/link';
import { ArrowRight, Briefcase, Clock, Sparkles, Users } from 'lucide-react';
import { fmtDate, type Trip } from '@/lib/client';
import { Avatar, GenderBadge, ModeBadge, NightBadge, StatusPill, TrustBadge } from './ui';

const short = (n: string) => n.split(' (')[0];

export function TripCard({ trip, action, compact }: { trip: Trip; action?: React.ReactNode; compact?: boolean }) {
  const s = trip.score;
  return (
    <div className="card overflow-hidden transition hover:shadow-lg">
      <Link href={`/trips/${trip.id}`} className="block p-4" aria-label={`Open trip ${short(trip.origin.name)} to ${short(trip.dest.name)}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          <ModeBadge mode={trip.mode} /><GenderBadge pref={trip.genderPref} />
          {trip.nightMode && <NightBadge />}
          {trip.status !== 'OPEN' && <StatusPill status={trip.status} />}
          {trip.delayMins > 0 && <span className="badge bg-amber-100 text-amber-800">Delayed {trip.delayMins}m</span>}
          {s && s.total > 0 && <span className="badge ml-auto bg-brand-600 text-white"><Sparkles className="h-3 w-3" />{Math.round(s.total)}% match</span>}
        </div>
        <div className="mt-2.5 flex items-center gap-2 text-base font-bold text-slate-900">
          <span className="truncate">{short(trip.origin.name)}</span><ArrowRight className="h-4 w-4 shrink-0 text-slate-400" /><span className="truncate">{short(trip.dest.name)}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDate(trip.date)} · {trip.windowStart}–{trip.windowEnd}</span>
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{trip.members.filter((m) => m.status === 'JOINED').length}/{trip.seats} riders</span>
          <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{trip.bagsUsed}/{trip.bagCapacity >= 99 ? '∞' : trip.bagCapacity} bags</span>
          {(trip.trainNumber || trip.flightNumber) && <span className="chip">{trip.trainNumber ? `Train ${trip.trainNumber}` : `Flight ${trip.flightNumber}`}</span>}
        </div>
        {!compact && (
          <div className="mt-3 flex items-center gap-1">
            {trip.members.filter((m) => m.status === 'JOINED').slice(0, 6).map((m) => <span key={m.userId} title={`${m.firstName} · ${m.department} · trust ${m.trustScore}`}><Avatar name={m.firstName} size={28} /></span>)}
            {Array.from({ length: Math.max(0, trip.seatsLeft) }).slice(0, 4).map((_, i) => <span key={i} className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-slate-300 text-[10px] text-slate-400">+</span>)}
            <span className="ml-2 text-xs text-slate-500">Host {trip.hostName}</span>
            {trip.members[0] && <span className="ml-auto"><TrustBadge score={Math.round(trip.members.filter((m) => m.status === 'JOINED').reduce((a, m) => a + m.trustScore, 0) / Math.max(1, trip.members.filter((m) => m.status === 'JOINED').length))} /></span>}
          </div>
        )}
        {s && s.reasons.length > 0 && !compact && <div className="mt-2 flex flex-wrap gap-1">{s.reasons.slice(0, 4).map((r) => <span key={r} className="chip">{r}</span>)}</div>}
        {s && s.blockers.length > 0 && <div className="mt-2 text-xs font-medium text-amber-700">⚠ {s.blockers.join(' · ')}</div>}
      </Link>
      {action && <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">{action}</div>}
    </div>
  );
}
