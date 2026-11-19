'use client';

import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Flame, TrendingUp, Zap } from 'lucide-react';
import { ErrorBox, PageLoader, Stat } from '@/components/ui';
import { fmtDate } from '@/lib/client';
import { useData } from '@/lib/useData';

type Cell = { date: string; hour: number; count: number; multiplier: number };
type Surge = { hasData: boolean; configured: boolean; today: string; breakStart: string; breakEnd: string; breakLabel: string; baseline: number; heat: Cell[]; days: { date: string; total: number; peakHour: number; peakMultiplier: number; inBreak: boolean }[]; peak: Cell; lockSavingPct: number };

const hr = (h: number) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;
const heatColor = (m: number) => (m >= 2.2 ? '#b91c1c' : m >= 1.8 ? '#dc2626' : m >= 1.5 ? '#f97316' : m >= 1.2 ? '#fbbf24' : m > 1 ? '#fde68a' : '#e2e8f0');

export default function SurgePage() {
  const s = useData<Surge>('/api/surge');
  if (s.loading && !s.data) return <PageLoader />;
  if (s.error || !s.data) return <ErrorBox message={s.error || 'Failed to load'} onRetry={s.reload} />;
  const d = s.data;
  const hours = Array.from({ length: 19 }, (_, i) => i + 5);
  const dates = d.days.map((x) => x.date);
  const peakDay = d.days.find((x) => x.date === d.peak.date);
  const chart = d.days.map((x) => ({ date: fmtDate(x.date), total: x.total, inBreak: x.inBreak, mult: x.peakMultiplier }));
  const lockUrl = `/trips/new?date=${d.peak.date}&from=${String(d.peak.hour - 1).padStart(2, '0')}:00&to=${String(d.peak.hour + 1).padStart(2, '0')}:00`;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Vacation surge planner</h1><p className="text-sm text-slate-600">{d.breakLabel} · {fmtDate(d.breakStart)} – {fmtDate(d.breakEnd)}. Predicted from aggregated, anonymised trip intents.</p></div>

      {!d.hasData || d.peak.multiplier <= 1 ? (
        <div className="card p-5 text-sm text-slate-600" data-testid="surge-nodata"><b className="text-slate-900">Not enough trip plans yet to predict a surge.</b> As students plan trips for the coming days, hourly demand and the expected cab-price pressure appear here. {!d.configured && 'Student Affairs can set the vacation window in the admin console.'}</div>
      ) : (
      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-amber-500 p-5 text-white shadow-card">
        <div className="flex flex-wrap items-center gap-4">
          <Flame className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1"><div className="text-2xl font-extrabold sm:text-3xl" data-testid="surge-headline">{d.peak.multiplier}× cab surge predicted on {new Date(d.peak.date + 'T00:00:00Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {hr(d.peak.hour)}</div>
            <div className="mt-1 text-sm text-white/90">{d.peak.count} students heading out that hour vs a normal-evening baseline of ~{d.baseline}. Solo cab prices at that hour could be {d.peak.multiplier}× normal.</div></div>
          <Link href={lockUrl} className="btn bg-white text-red-700 hover:bg-red-50" data-testid="lock-cta"><Zap className="h-4 w-4" />Lock Early Crew & Save {d.lockSavingPct}%<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Peak day" value={peakDay ? fmtDate(peakDay.date) : '–'} sub={`${peakDay?.total ?? 0} departures`} tone="danger" icon={<Flame className="h-5 w-5" />} />
        <Stat label="Peak surge" value={`${d.peak.multiplier}×`} sub={hr(d.peak.hour)} tone="warn" icon={<TrendingUp className="h-5 w-5" />} />
        <Stat label="Normal evening" value={`~${d.baseline}/hr`} sub="baseline demand" />
        <Stat label="Early-lock saving" value={`${d.lockSavingPct}%`} sub="avoids surge premium" tone="eco" icon={<Zap className="h-5 w-5" />} />
      </div>

      <div className="card p-4">
        <h2 className="mb-1 font-bold text-slate-900">Predicted departures per day</h2>
        <p className="mb-3 text-xs text-slate-500">Bars in red fall inside the vacation window.</p>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{ left: -10, right: 6 }}><CartesianGrid vertical={false} stroke="#e2e8f0" /><XAxis dataKey="date" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={52} /><YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={((v: number, _n: unknown, p: { payload: { mult: number } }) => [`${v} students · peak ${p.payload.mult}×`, 'Demand']) as never} />
          <Bar dataKey="total" radius={[6, 6, 0, 0]}>{chart.map((c, i) => <Cell key={i} fill={c.inBreak ? '#dc2626' : '#818cf8'} />)}</Bar></BarChart></ResponsiveContainer></div>
      </div>

      <div className="card p-4">
        <h2 className="mb-1 font-bold text-slate-900">Demand heatmap (day × hour)</h2>
        <p className="mb-3 text-xs text-slate-500">Darker = higher predicted surge multiplier. Tap a cell for details.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-[10px]" aria-label="Demand heatmap">
          <thead><tr><th className="w-20" />{hours.map((h) => <th key={h} className="font-semibold text-slate-500">{h}</th>)}</tr></thead>
          <tbody>{dates.map((dt) => (
            <tr key={dt}><th className={`pr-2 text-right text-xs font-semibold ${d.days.find((x) => x.date === dt)?.inBreak ? 'text-red-700' : 'text-slate-600'}`}>{fmtDate(dt)}</th>
              {hours.map((h) => { const c = d.heat.find((x) => x.date === dt && x.hour === h)!; return <td key={h} title={`${fmtDate(dt)} ${hr(h)}: ${c.count} students · ${c.multiplier}× surge`} className="h-6 rounded text-center font-bold text-white/90" style={{ background: heatColor(c.multiplier) }}>{c.multiplier >= 1.5 ? c.multiplier.toFixed(1) : ''}</td>; })}</tr>))}</tbody></table></div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">Surge: {[['1×', '#e2e8f0'], ['1.2×', '#fbbf24'], ['1.5×', '#f97316'], ['1.8×', '#dc2626'], ['2.2×+', '#b91c1c']].map(([l, c]) => <span key={l} className="flex items-center gap-1"><span className="h-3 w-3 rounded" style={{ background: c }} />{l}</span>)}</div>
      </div>
    </div>
  );
}
