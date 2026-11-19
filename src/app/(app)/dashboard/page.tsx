'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Compass, Leaf, MapPin, Plus, Radio, TicketsPlane, TrendingUp } from 'lucide-react';
import { useAuth } from '@/components/Providers';
import { TripCard } from '@/components/TripCard';
import { EmptyState, ErrorBox, PageLoader, SectionTitle, Stat, VerifiedBadge } from '@/components/ui';
import { rupees, type Trip } from '@/lib/client';
import { useData } from '@/lib/useData';

type Mine = { active: Trip[]; upcoming: Trip[]; past: Trip[] };
type Surge = { hasData: boolean; peak: { date: string; hour: number; multiplier: number }; breakLabel: string; lockSavingPct: number };
type Eco = { mine: { moneySaved: number; co2Kg: number; cabsEliminated: number; trips: number } | null };

export default function Dashboard() {
  const { user, dues } = useAuth();
  const mine = useData<Mine>('/api/groups/mine', { poll: 15000 });
  const surge = useData<Surge>('/api/surge');
  const eco = useData<Eco>('/api/eco');

  if (!user) return null;
  if (user.role === 'ADMIN') return <AdminRedirect />;
  const totalDue = dues.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Hi {user.name.split(' ')[0]} 👋</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600"><VerifiedBadge label={user.idType ? 'ID verified' : 'IIITA student'} /><span>{user.department} · {user.hostel}</span></div>
        </div>
        <Link href="/trips/new" className="btn-primary"><Plus className="h-4 w-4" />Plan a trip</Link>
      </div>

      {dues.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1 text-sm"><b>Booking locked — {rupees(totalDue)} unsettled.</b> {dues[0].route}. Pay your co-rider to join or create trips again.</div>
          <Link href={`/trips/${dues[0].groupId}`} className="btn-danger btn-sm">Settle now</Link>
        </div>
      )}

      {surge.data && surge.data.hasData && surge.data.peak.multiplier > 1 && (
        <Link href="/surge" className="block rounded-2xl bg-gradient-to-r from-brand-900 to-brand-700 p-4 text-white shadow-card">
          <div className="flex items-center gap-3"><TrendingUp className="h-8 w-8 shrink-0 text-amber-300" />
            <div className="min-w-0 flex-1"><div className="font-extrabold">{surge.data.peak.multiplier}× cab surge predicted on {new Date(surge.data.peak.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {surge.data.peak.hour % 12 || 12} {surge.data.peak.hour >= 12 ? 'PM' : 'AM'}</div>
              <div className="text-sm text-indigo-100">{surge.data.breakLabel} — lock an early crew and save up to {surge.data.lockSavingPct}%.</div></div>
            <ArrowRight className="h-5 w-5 shrink-0" /></div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rides completed" value={user.completedRides} sub="with your crews" icon={<Compass className="h-5 w-5" />} />
        <Stat label="Money saved" value={rupees(eco.data?.mine?.moneySaved ?? 0)} tone="eco" sub="vs. riding solo" icon={<Leaf className="h-5 w-5" />} />
        <Stat label="CO₂ saved" value={`${eco.data?.mine?.co2Kg ?? 0} kg`} tone="eco" sub={`${eco.data?.mine?.cabsEliminated ?? 0} solo cabs avoided`} icon={<Leaf className="h-5 w-5" />} />
        <Stat label="Upcoming" value={mine.data?.upcoming.length ?? '–'} tone="warn" sub="crews you're in" icon={<MapPin className="h-5 w-5" />} />
      </div>

      {mine.loading && !mine.data && <PageLoader />}
      {mine.error && <ErrorBox message={mine.error} onRetry={mine.reload} />}

      {mine.data && mine.data.active.length > 0 && (
        <section><SectionTitle title="Live now" sub="Your ride is in progress" />
          <div className="grid gap-3 md:grid-cols-2">{mine.data.active.map((t) => <TripCard key={t.id} trip={t} action={<span className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Radio className="h-4 w-4 animate-pulse" />Open live trip room · SOS & tracking</span>} />)}</div></section>
      )}

      {mine.data && (
        <section><SectionTitle title="Your upcoming crews" action={<Link href="/trips?tab=mine" className="text-sm font-semibold text-brand-700">View all</Link>} />
          {mine.data.upcoming.length === 0 ? (
            <EmptyState icon={<TicketsPlane className="h-6 w-6" />} title="No trips yet" hint="Plan a multi-leg journey or find an open crew heading your way." action={<div className="mt-2 flex gap-2"><Link href="/trips/new" className="btn-primary btn-sm">Plan a trip</Link><Link href="/trips" className="btn-secondary btn-sm">Browse crews</Link></div>} />
          ) : <div className="grid gap-3 md:grid-cols-2">{mine.data.upcoming.slice(0, 4).map((t) => <TripCard key={t.id} trip={t} />)}</div>}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/buddies" className="card flex items-center gap-3 p-4 hover:shadow-lg"><TicketsPlane className="h-6 w-6 text-brand-600" /><div><div className="font-bold">Same-train buddies</div><div className="text-xs text-slate-500">Opt-in, privacy first</div></div></Link>
        <Link href="/eco" className="card flex items-center gap-3 p-4 hover:shadow-lg"><Leaf className="h-6 w-6 text-emerald-600" /><div><div className="font-bold">Eco leaderboard</div><div className="text-xs text-slate-500">Hostel vs hostel</div></div></Link>
        <Link href="/profile" className="card flex items-center gap-3 p-4 hover:shadow-lg"><Compass className="h-6 w-6 text-amber-600" /><div><div className="font-bold">Profile & safety</div><div className="text-xs text-slate-500">Your trust score lives here</div></div></Link>
      </section>
    </div>
  );
}

function AdminRedirect() {
  return <EmptyState title="Admin account" hint="Use the Console for demand planning and safety moderation." action={<Link href="/admin" className="btn-primary btn-sm">Open console</Link>} />;
}
