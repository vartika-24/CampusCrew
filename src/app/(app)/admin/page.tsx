'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bus, Leaf, MapPin, ShieldAlert, ShieldCheck, Siren, UserX, Users } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { EmptyState, ErrorBox, PageLoader, SectionTitle, Stat, TrustBadge } from '@/components/ui';
import { api, fmtDate, fmtTimeAgo, rupees } from '@/lib/client';
import { useData } from '@/lib/useData';
import { REPORT_TYPE_LABEL } from '@/lib/constants';

type Overview = { students: number; verified: number; suspended: number; openTrips: number; liveTrips: number; completed: number; todaysTrips: number; activeSos: number; openReports: number; lowTrust: number; eco: { moneySaved: number; co2Kg: number; cabsEliminated: number; trips: number } };
type Demand = { date: string; hours: { hour: number; label: string; junction: number; airport: number; total: number; multiplier: number; buses: number }[]; plan: { time: string; to: string; buses: number; students: number }[]; shuttleSeats: number; totalBuses: number; totalStudents: number; dates: string[] };
type Alert = { id: string; status: string; lat: number; lng: number; note: string | null; createdAt: string; resolvedAt: string | null; resolvedNote: string | null; rider: { name: string; hostel: string | null; department: string; trustScore: number }; trip: { id: string; route: string; plate: string | null; driver: string | null; riders: string[]; status: string } };
type Report = { id: string; type: string; status: string; description: string; resolution: string | null; createdAt: string; reporter: { name: string }; target: { id: string; name: string; trustScore: number; suspended: boolean; hostel: string | null } | null; trip: string | null };
type User = { id: string; name: string; email: string; department: string; hostel: string | null; trustScore: number; completedRides: number; cancelCount: number; lateCancels: number; suspended: boolean };

const TABS = [['overview', 'Overview'], ['demand', 'Demand & shuttles'], ['safety', 'Safety queue'], ['users', 'Students']] as const;

function Console() {
  const { user } = useAuth();
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (TABS.find(([k]) => k === sp.get('tab'))?.[0] ?? 'overview') as (typeof TABS)[number][0];
  if (user?.role !== 'ADMIN') return <EmptyState title="Admin only" hint="This console is for the IIITA Transport & Student Affairs Office." action={<Link href="/dashboard" className="btn-primary btn-sm mt-2">Back home</Link>} />;
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Transport & campus safety console</h1><p className="text-sm text-slate-600">IIIT Allahabad · demand planning, live SOS and moderation</p></div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1 text-sm font-semibold" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => router.push(k === 'overview' ? '/admin' : `/admin?tab=${k}`)} className={`whitespace-nowrap rounded-lg px-4 py-1.5 ${tab === k ? 'bg-white shadow' : 'text-slate-600'}`}>{l}</button>)}
      </div>
      {tab === 'overview' && <OverviewTab />}
      {tab === 'demand' && <DemandTab />}
      {tab === 'safety' && <SafetyTab />}
      {tab === 'users' && <UsersTab />}
    </div>
  );
}

function OverviewTab() {
  const o = useData<Overview>('/api/admin/overview', { poll: 10000 });
  if (o.loading && !o.data) return <PageLoader />;
  if (o.error || !o.data) return <ErrorBox message={o.error || 'Failed'} onRetry={o.reload} />;
  const d = o.data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Active SOS" value={d.activeSos} tone={d.activeSos ? 'danger' : 'eco'} icon={<Siren className="h-5 w-5" />} sub="needs response" />
        <Stat label="Open reports" value={d.openReports} tone="warn" icon={<ShieldAlert className="h-5 w-5" />} />
        <Stat label="Verified students" value={`${d.verified}/${d.students}`} icon={<Users className="h-5 w-5" />} sub={`${d.lowTrust} below trust 70`} />
        <Stat label="Live trips" value={d.liveTrips} tone="eco" icon={<MapPin className="h-5 w-5" />} sub={`${d.openTrips} upcoming open`} />
        <Stat label="Completed trips" value={d.completed} icon={<ShieldCheck className="h-5 w-5" />} />
        <Stat label="Student savings" value={rupees(d.eco.moneySaved)} tone="eco" icon={<Leaf className="h-5 w-5" />} />
        <Stat label="CO₂ avoided" value={`${d.eco.co2Kg} kg`} tone="eco" icon={<Leaf className="h-5 w-5" />} sub={`${d.eco.cabsEliminated} solo cabs`} />
        <Stat label="Suspended" value={d.suspended} tone="warn" icon={<UserX className="h-5 w-5" />} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2"><Link href="/admin?tab=safety" className="card p-4 font-semibold text-brand-700 hover:shadow-lg">Open safety moderation queue →</Link><Link href="/admin?tab=demand" className="card p-4 font-semibold text-brand-700 hover:shadow-lg">Plan institute shuttles →</Link></div>
    </div>
  );
}

function DemandTab() {
  const [date, setDate] = useState('');
  const d = useData<Demand>(`/api/admin/demand${date ? `?date=${date}` : ''}`);
  if (d.loading && !d.data) return <PageLoader />;
  if (d.error || !d.data) return <ErrorBox message={d.error || 'Failed'} onRetry={d.reload} />;
  const x = d.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2"><span className="label !mb-0">Date</span>{x.dates.map((dt) => <button key={dt} onClick={() => setDate(dt)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${x.date === dt ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{fmtDate(dt)}</button>)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3"><Stat label="Students heading out" value={x.totalStudents} icon={<Users className="h-5 w-5" />} sub="to Junction + Airport" /><Stat label="Shuttle trips advised" value={x.totalBuses} tone="warn" icon={<Bus className="h-5 w-5" />} sub={`${x.shuttleSeats}-seat institute buses`} /><Stat label="Peak hour" value={x.hours.reduce((a, b) => (b.total > a.total ? b : a)).label} tone="danger" sub={`${x.hours.reduce((a, b) => (b.total > a.total ? b : a)).total} students`} /></div>
      <div className="card p-4"><h2 className="mb-3 font-bold text-slate-900">Hourly demand · {fmtDate(x.date)}</h2>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={x.hours} margin={{ left: -10, right: 6 }}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="junction" name="Prayagraj Junction" stackId="a" fill="#4f46e5" /><Bar dataKey="airport" name="Airport (IXD)" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      <div className="card overflow-hidden"><h2 className="border-b border-slate-100 p-4 font-bold text-slate-900">Recommended institute shuttle schedule</h2>
        {x.plan.length === 0 ? <p className="p-4 text-sm text-slate-500">Demand is low on this date; no shuttles needed.</p> : (
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">Departure</th><th className="text-left">Route</th><th className="text-right">Students</th><th className="pr-4 text-right">Buses</th></tr></thead>
            <tbody>{x.plan.map((p) => <tr key={p.time} className="border-t border-slate-100"><td className="px-4 py-2 font-mono font-bold">{p.time}</td><td>IIITA Gate 1 → {p.to}</td><td className="text-right">{p.students}</td><td className="pr-4 text-right font-bold">{p.buses}</td></tr>)}</tbody></table>)}
        <p className="border-t border-slate-100 p-3 text-xs text-slate-500">Assumes a shuttle can absorb ~55% of demand; each bus seats {x.shuttleSeats}. Demand blends anonymised aggregate intent with live trip plans.</p></div>
    </div>
  );
}

function SafetyTab() {
  const s = useData<{ alerts: Alert[]; activeCount: number; reports: Report[] }>('/api/admin/safety', { poll: 4000 });
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(url: string, body: unknown, msg: string, id: string) {
    setBusy(id);
    try { await api(url, { body }); toast.push('success', msg); s.reload(); } catch (e) { toast.push('error', (e as Error).message); } finally { setBusy(null); }
  }
  if (s.loading && !s.data) return <PageLoader />;
  if (s.error || !s.data) return <ErrorBox message={s.error || 'Failed'} onRetry={s.reload} />;
  const active = s.data.alerts.filter((a) => a.status === 'ACTIVE');
  const resolved = s.data.alerts.filter((a) => a.status !== 'ACTIVE');
  return (
    <div className="space-y-6">
      <section><SectionTitle title="Live SOS" sub={active.length ? `${active.length} active — respond immediately` : 'No active emergencies'} />
        {active.length === 0 ? <div className="card flex items-center gap-2 p-4 text-sm text-emerald-700"><ShieldCheck className="h-5 w-5" />All clear.</div> : (
          <div className="space-y-3">{active.map((a) => (
            <div key={a.id} className="rounded-2xl border-2 border-red-500 bg-red-50 p-4 shadow-card" data-testid="sos-alert">
              <div className="flex flex-wrap items-start gap-3"><Siren className="h-6 w-6 shrink-0 animate-pulse text-red-600" />
                <div className="min-w-0 flex-1"><div className="font-extrabold text-red-900">SOS · {a.rider.name} <span className="font-medium">({a.rider.department}{a.rider.hostel ? `, ${a.rider.hostel}` : ''})</span></div>
                  <div className="text-sm text-red-900">{a.trip.route} · {a.trip.plate ? `${a.trip.plate} · ${a.trip.driver}` : 'no vehicle'} · co-riders: {a.trip.riders.join(', ')}</div>
                  <div className="mt-1 font-mono text-xs text-red-800">GPS {a.lat.toFixed(5)}, {a.lng.toFixed(5)} · <a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${a.lat}&mlon=${a.lng}#map=15/${a.lat}/${a.lng}`}>open map</a> · {fmtTimeAgo(a.createdAt)}</div></div>
                <button className="btn-danger btn-sm" disabled={busy === a.id} onClick={() => act(`/api/admin/alerts/${a.id}`, { action: 'resolve', note: 'Security team reached the vehicle; rider confirmed safe.' }, 'SOS marked resolved', a.id)}>Resolve</button></div></div>))}</div>)}
      </section>

      <section><SectionTitle title="Reports & disputes" sub={`${s.data.reports.filter((r) => r.status === 'OPEN').length} open`} />
        {s.data.reports.length === 0 ? <EmptyState title="No reports" /> : <div className="space-y-3">{s.data.reports.map((r) => (
          <div key={r.id} className="card p-4"><div className="flex flex-wrap items-center gap-2"><span className={`badge ${r.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>{r.status}</span><span className="badge bg-brand-50 text-brand-700">{REPORT_TYPE_LABEL[r.type] ?? r.type}</span><span className="text-xs text-slate-400">{fmtTimeAgo(r.createdAt)}{r.trip ? ` · ${r.trip}` : ''}</span></div>
            <p className="mt-2 text-sm text-slate-800">{r.description}</p>
            <div className="mt-1 text-xs text-slate-500">Reported by <b>{r.reporter.name}</b>{r.target && <> against <b>{r.target.name}</b> <TrustBadge score={r.target.trustScore} />{r.target.suspended && <span className="badge ml-1 bg-red-100 text-red-700">Suspended</span>}</>}</div>
            {r.resolution && <div className="mt-1 text-xs text-slate-500">Outcome: {r.resolution}</div>}
            {r.status === 'OPEN' && <div className="mt-3 flex flex-wrap gap-2"><button className="btn-secondary btn-sm" disabled={busy === r.id} onClick={() => act(`/api/admin/reports/${r.id}`, { action: 'resolve' }, 'Report resolved', r.id)}>Resolve</button>
              {r.target && <button className="btn-warn btn-sm" disabled={busy === r.id} onClick={() => act(`/api/admin/reports/${r.id}`, { action: 'penalize' }, 'Trust score penalised (−10)', r.id)}>Penalize Trust Score</button>}
              {r.target && !r.target.suspended && <button className="btn-danger btn-sm" disabled={busy === r.id} onClick={() => confirm(`Suspend ${r.target!.name}?`) && act(`/api/admin/reports/${r.id}`, { action: 'suspend' }, 'Account suspended', r.id)}>Suspend Account</button>}</div>}
          </div>))}</div>}
      </section>

      {resolved.length > 0 && <section><SectionTitle title="Recent resolved SOS" /><div className="space-y-2">{resolved.map((a) => <div key={a.id} className="card p-3 text-sm"><b>{a.rider.name}</b> · {a.trip.route} · <span className="text-slate-500">{a.resolvedNote}</span> <span className="text-xs text-slate-400">({fmtTimeAgo(a.createdAt)})</span></div>)}</div></section>}
    </div>
  );
}

function UsersTab() {
  const u = useData<{ users: User[] }>('/api/admin/users');
  const toast = useToast();
  async function act(id: string, action: 'suspend' | 'unsuspend') {
    try { await api(`/api/admin/users/${id}`, { body: { action } }); toast.push('success', action === 'suspend' ? 'Suspended' : 'Reinstated'); u.reload(); } catch (e) { toast.push('error', (e as Error).message); }
  }
  if (u.loading && !u.data) return <PageLoader />;
  if (u.error || !u.data) return <ErrorBox message={u.error || 'Failed'} onRetry={u.reload} />;
  return (
    <div className="card overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">Student</th><th className="text-left">Dept · Hostel</th><th className="text-center">Trust</th><th className="text-center">Rides</th><th className="text-center">Cancels</th><th className="pr-4 text-right">Action</th></tr></thead>
      <tbody>{u.data.users.map((s) => <tr key={s.id} className="border-t border-slate-100"><td className="px-4 py-2"><div className="font-semibold">{s.name}</div><div className="text-xs text-slate-400">{s.email}</div></td><td>{s.department} · {s.hostel}</td><td className="text-center"><TrustBadge score={s.trustScore} /></td><td className="text-center">{s.completedRides}</td><td className="text-center">{s.cancelCount} ({s.lateCancels} late)</td><td className="pr-4 text-right">{s.suspended ? <button className="btn-secondary btn-sm" onClick={() => act(s.id, 'unsuspend')}>Reinstate</button> : <button className="btn-ghost btn-sm text-red-600" onClick={() => confirm(`Suspend ${s.name}?`) && act(s.id, 'suspend')}>Suspend</button>}</td></tr>)}</tbody></table></div>
  );
}

export default function AdminPage() {
  return <Suspense fallback={<PageLoader />}><Console /></Suspense>;
}
