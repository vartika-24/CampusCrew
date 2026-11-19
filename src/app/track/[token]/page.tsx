'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Car, Clock, Compass, Moon, ShieldCheck, TrainFront } from 'lucide-react';
import { RouteMap } from '@/components/RouteMap';
import { ErrorBox, PageLoader } from '@/components/ui';
import { api, fmtDate } from '@/lib/client';

type Track = {
  state: 'ARRIVED' | 'ON_THE_WAY' | 'NOT_STARTED'; origin: { name: string; lat: number; lng: number }; dest: { name: string; lat: number; lng: number };
  route: { lat: number; lng: number }[]; position: { lat: number; lng: number }; progress: number; etaMinutes: number; etaRemaining: number; km: number;
  mode: string; date: string; windowStart: string; windowEnd: string; delayMins: number; trainNumber: string | null; flightNumber: string | null; nightMode: boolean;
  operator: { name: string; plate: string; vehicleName: string; badge: string } | null; riders: { firstName: string; verified: boolean; boarded: boolean }[]; updatedAt: string;
};

export default function TrackPage({ params }: { params: { token: string } }) {
  const [t, setT] = useState<Track | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    const load = () => api<Track>(`/api/track/${params.token}`).then((d) => { if (live) { setT(d); setErr(''); } }).catch((e: Error) => live && setErr(e.message));
    void load();
    const id = setInterval(load, 3000);
    return () => { live = false; clearInterval(id); };
  }, [params.token]);

  const badge = t?.state === 'ARRIVED' ? { text: 'Arrived safely', cls: 'bg-emerald-100 text-emerald-800' } : t?.state === 'ON_THE_WAY' ? { text: 'On the way — live', cls: 'bg-indigo-100 text-indigo-800' } : { text: 'Not started yet', cls: 'bg-slate-100 text-slate-700' };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-brand-900 text-white"><div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 font-extrabold"><Compass className="h-5 w-5 text-emerald-300" />CampusCrew <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold">Read-only live trip</span></div></header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5">
        {err && <ErrorBox message={err} />}
        {!t && !err && <PageLoader text="Fetching live location…" />}
        {t && (
          <>
            <div className="card p-4">
              <div className="flex flex-wrap items-center gap-2"><span className={`badge ${badge.cls}`}>{t.state === 'ON_THE_WAY' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-600" />}{badge.text}</span>
                {t.nightMode && <span className="badge bg-indigo-900 text-indigo-100"><Moon className="h-3 w-3" />Night Safety Mode</span>}
                {t.delayMins > 0 && <span className="badge bg-amber-100 text-amber-800"><Clock className="h-3 w-3" />Delayed {t.delayMins} min</span>}</div>
              <h1 className="mt-2 text-lg font-extrabold text-slate-900">{t.origin.name} → {t.dest.name}</h1>
              <p className="text-sm text-slate-500">{fmtDate(t.date)} · pickup window {t.windowStart}–{t.windowEnd}{t.trainNumber ? ` · Train ${t.trainNumber}` : ''}{t.flightNumber ? ` · Flight ${t.flightNumber}` : ''}</p>
            </div>
            <RouteMap route={t.route} position={t.position} origin={t.origin.name} dest={t.dest.name} progress={t.progress} vehicleLabel={t.operator?.plate} />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="card p-3"><div className="text-xs font-semibold uppercase text-slate-500">Progress</div><div className="text-xl font-extrabold text-brand-700">{Math.round(t.progress * 100)}%</div></div>
              <div className="card p-3"><div className="text-xs font-semibold uppercase text-slate-500">ETA</div><div className="text-xl font-extrabold text-slate-900">{t.state === 'ARRIVED' ? 'Arrived' : `${t.etaRemaining} min`}</div></div>
              <div className="card p-3"><div className="text-xs font-semibold uppercase text-slate-500">Distance</div><div className="text-xl font-extrabold text-slate-900">{t.km} km</div></div>
            </div>
            {t.operator && (
              <div className="card flex items-center gap-3 p-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><Car className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{t.operator.name} · {t.operator.vehicleName}</div><div className="text-sm text-slate-600">Plate <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-xs font-bold text-white">{t.operator.plate}</span></div></div>
                <span className="badge bg-emerald-50 text-emerald-700"><ShieldCheck className="h-3 w-3" />Licensed</span>
              </div>
            )}
            {!t.operator && t.mode !== 'CAB' && t.mode !== 'AUTO' && <div className="card flex items-center gap-2 p-4 text-sm text-slate-600"><TrainFront className="h-4 w-4" />Travelling by {t.mode.toLowerCase()} together as a verified crew.</div>}
            <div className="card p-4">
              <h2 className="mb-2 text-sm font-bold text-slate-900">Co-riders (verified students)</h2>
              <ul className="space-y-1.5">{t.riders.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm"><span className="font-medium text-slate-800">{r.firstName}</span>
                  <span className="flex gap-1.5">{r.boarded && <span className="badge bg-sky-50 text-sky-700">Boarded</span>}{r.verified && <span className="badge bg-emerald-50 text-emerald-700"><BadgeCheck className="h-3 w-3" />Verified</span>}</span></li>))}</ul>
            </div>
            <p className="text-center text-xs text-slate-500">Location is a simulation for demo purposes. First names only · no phone numbers, seats or home addresses are ever shown. Updated {new Date(t.updatedAt).toLocaleTimeString('en-IN')}.</p>
          </>
        )}
      </main>
    </div>
  );
}
