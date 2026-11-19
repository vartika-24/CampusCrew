'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Car, Leaf, Medal, Trophy, Wallet } from 'lucide-react';
import { useAuth } from '@/components/Providers';
import { ErrorBox, PageLoader, SectionTitle, Stat } from '@/components/ui';
import { rupees, fmtDate } from '@/lib/client';
import { useData } from '@/lib/useData';

type Sum = { moneySaved: number; cabsEliminated: number; co2Kg: number; trips: number };
type Eco = { campus: Sum; mine: Sum | null; hostels: (Sum & { hostel: string })[]; students: (Sum & { userId: string; name: string; hostel: string | null })[]; trend: { date: string; saved: number }[]; myHostel: string | null };

export default function EcoPage() {
  const { user } = useAuth();
  const e = useData<Eco>('/api/eco');
  if (e.loading && !e.data) return <PageLoader />;
  if (e.error || !e.data) return <ErrorBox message={e.error || 'Failed'} onRetry={e.reload} />;
  const d = e.data;
  const hostelData = d.hostels.map((h) => ({ ...h, mine: h.hostel === d.myHostel }));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Eco & savings impact</h1><p className="text-sm text-slate-600">Shared cabs cut costs and emissions. Computed from every completed crew on campus.</p></div>

      <section><SectionTitle title="Your impact" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Money saved" value={rupees(d.mine?.moneySaved ?? 0)} tone="eco" icon={<Wallet className="h-5 w-5" />} sub="vs riding solo" />
          <Stat label="Solo cabs eliminated" value={d.mine?.cabsEliminated ?? 0} tone="eco" icon={<Car className="h-5 w-5" />} sub="your share" />
          <Stat label="CO₂ saved" value={`${d.mine?.co2Kg ?? 0} kg`} tone="eco" icon={<Leaf className="h-5 w-5" />} />
          <Stat label="Shared trips" value={d.mine?.trips ?? 0} icon={<Trophy className="h-5 w-5" />} />
        </div></section>

      <section><SectionTitle title="Campus-wide impact" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Money saved" value={rupees(d.campus.moneySaved)} tone="eco" icon={<Wallet className="h-5 w-5" />} />
          <Stat label="Solo cabs eliminated" value={d.campus.cabsEliminated} tone="eco" icon={<Car className="h-5 w-5" />} />
          <Stat label="CO₂ saved" value={`${d.campus.co2Kg} kg`} tone="eco" icon={<Leaf className="h-5 w-5" />} sub={`≈ ${Math.round(d.campus.co2Kg / 21)} trees for a year`} />
          <Stat label="Shared trips" value={d.campus.trips} icon={<Trophy className="h-5 w-5" />} />
        </div></section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4"><h2 className="mb-3 font-bold text-slate-900">{user?.role === 'ADMIN' ? 'Campus' : 'Your'} cumulative savings (₹)</h2>
          <div className="h-60">{d.trend.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">Complete a shared trip to see your trend.</p> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={d.trend.map((t) => ({ ...t, date: fmtDate(t.date) }))} margin={{ left: -10, right: 6 }}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.35} /><stop offset="95%" stopColor="#059669" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={((v: number) => rupees(v)) as never} /><Area type="monotone" dataKey="saved" stroke="#059669" strokeWidth={2.5} fill="url(#g)" /></AreaChart></ResponsiveContainer>}</div></div>
        <div className="card p-4"><h2 className="mb-3 font-bold text-slate-900">Hostel leaderboard · CO₂ saved (kg)</h2>
          <div className="h-60"><ResponsiveContainer width="100%" height="100%"><BarChart data={hostelData} layout="vertical" margin={{ left: 10, right: 16 }}><CartesianGrid horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="hostel" width={70} tick={{ fontSize: 12, fontWeight: 600 }} /><Tooltip formatter={((v: number, _n: unknown, p: { payload: Sum }) => [`${v} kg · ${rupees(p.payload.moneySaved)} saved`, 'CO₂']) as never} /><Bar dataKey="co2Kg" radius={[0, 6, 6, 0]}>{hostelData.map((h, i) => <Cell key={i} fill={h.mine ? '#059669' : '#6ee7b7'} />)}</Bar></BarChart></ResponsiveContainer></div>
          <p className="mt-1 text-xs text-slate-500">Your hostel highlighted. e.g. GH-2 vs BH-3.</p></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-hidden"><h2 className="border-b border-slate-100 p-4 font-bold text-slate-900">Hostel leaderboard</h2>
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">#</th><th className="text-left">Hostel</th><th className="text-right">CO₂</th><th className="text-right">Saved</th><th className="pr-4 text-right">Trips</th></tr></thead>
            <tbody>{d.hostels.map((h, i) => <tr key={h.hostel} className={`border-t border-slate-100 ${h.hostel === d.myHostel ? 'bg-emerald-50 font-semibold' : ''}`}><td className="px-4 py-2">{i === 0 ? <Medal className="h-4 w-4 text-amber-500" /> : i + 1}</td><td>{h.hostel}</td><td className="text-right">{h.co2Kg} kg</td><td className="text-right">{rupees(h.moneySaved)}</td><td className="pr-4 text-right">{h.trips}</td></tr>)}</tbody></table></div>
        <div className="card overflow-hidden"><h2 className="border-b border-slate-100 p-4 font-bold text-slate-900">Student sustainability leaderboard</h2>
          <table className="w-full text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-2 text-left">#</th><th className="text-left">Student</th><th className="text-left">Hostel</th><th className="text-right">CO₂</th><th className="pr-4 text-right">Saved</th></tr></thead>
            <tbody>{d.students.map((s, i) => <tr key={s.userId} className={`border-t border-slate-100 ${s.userId === user?.id ? 'bg-emerald-50 font-semibold' : ''}`}><td className="px-4 py-2">{i === 0 ? <Medal className="h-4 w-4 text-amber-500" /> : i + 1}</td><td>{s.name}</td><td>{s.hostel}</td><td className="text-right">{s.co2Kg} kg</td><td className="pr-4 text-right">{rupees(s.moneySaved)}</td></tr>)}</tbody></table></div>
      </div>
      <p className="text-xs text-slate-500">Method: savings = solo fare − your share; CO₂ = road km × 0.17 kg (cab) / 0.10 kg (auto) × vehicles avoided ÷ riders. Only cab/auto crews count as avoided vehicles.</p>
    </div>
  );
}
