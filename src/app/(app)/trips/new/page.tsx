'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Link2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { PlaceSelect } from '@/components/PlaceSelect';
import { ErrorBox, Field, PageLoader } from '@/components/ui';
import { api, type Place } from '@/lib/client';
import { useData, usePlaces } from '@/lib/useData';
import { GENDER_PREF_LABEL, MODES, MODE_LABEL, VEHICLE_SPECS } from '@/lib/constants';

type Leg = { originId: string; destId: string; date: string; windowStart: string; windowEnd: string; mode: string; vehicleType: string; luggage: number; genderPref: string; trainNumber: string; flightNumber: string };
type Meta = { today: string; settings: Record<string, string> };
type Result = { journey: { id: string; segments: { id: string; origin: { name: string }; dest: { name: string }; mode: string }[] }; results: { segmentId: string; action?: string; groupId?: string; status?: string; error?: string }[] };
const short = (n: string) => n.split(' (')[0];

function NewTrip() {
  const { user } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const toast = useToast();
  const places = usePlaces();
  const meta = useData<Meta>('/api/meta');
  const [legs, setLegs] = useState<Leg[] | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState<'match' | 'save' | null>(null);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const initial = useMemo<Leg[] | null>(() => {
    if (!places.length || !meta.data) return null;
    const date = sp.get('date') || meta.data.settings.breakStart || meta.data.today;
    return [{ originId: places.find((p) => p.kind === 'CAMPUS')?.id ?? '', destId: places.find((p) => p.kind !== 'CAMPUS')?.id ?? '', date, windowStart: sp.get('from') || '16:00', windowEnd: sp.get('to') || '17:30', mode: 'CAB', vehicleType: 'SEDAN4', luggage: 1, genderPref: 'MIXED', trainNumber: '', flightNumber: '' }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.length, !!meta.data]);
  const L = legs ?? initial;

  if (!user || !L || !meta.data) return <PageLoader />;
  const prefs = ['MIXED', ...((user.idCardStatus === 'VERIFIED' && user.gender === 'FEMALE') ? ['GIRLS_ONLY'] : []), ...((user.idCardStatus === 'VERIFIED' && user.gender === 'MALE') ? ['BOYS_ONLY'] : [])];
  const update = (i: number, patch: Partial<Leg>) => setLegs(L.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const placeName = (id: string) => short(places.find((p: Place) => p.id === id)?.name ?? '');

  function addLeg() {
    const last = L![L!.length - 1];
    const nextMode = last.mode === 'CAB' ? 'TRAIN' : 'AUTO';
    setLegs([...L!, { ...last, originId: last.destId, destId: '', mode: nextMode, vehicleType: nextMode === 'AUTO' ? 'AUTO' : 'SHARED', windowStart: last.windowEnd, windowEnd: last.windowEnd >= '23:00' ? '23:59' : `${String(Number(last.windowEnd.slice(0, 2)) + 1).padStart(2, '0')}:${last.windowEnd.slice(3)}`, luggage: 0, trainNumber: '', flightNumber: '' }]);
  }

  async function submit(autoMatch: boolean) {
    setErr(''); setBusy(autoMatch ? 'match' : 'save');
    try {
      const payload = L!.map((l) => ({ ...l, trainNumber: l.mode === 'TRAIN' || l.trainNumber ? l.trainNumber : undefined, flightNumber: l.mode === 'FLIGHT' ? l.flightNumber : undefined, vehicleType: l.mode === 'CAB' ? l.vehicleType : undefined }));
      const r = await api<Result>('/api/journeys', { body: { title, legs: payload, autoMatch } });
      if (L!.length === 1 && autoMatch && r.results[0]?.groupId) { toast.push('success', r.results[0].action === 'JOINED' ? 'Matched into an existing crew!' : 'You are hosting a new crew — others can now find it.'); router.push(`/trips/${r.results[0].groupId}`); return; }
      setResult(r);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card p-6 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" /><h1 className="mt-2 text-xl font-extrabold">Journey created</h1><p className="text-sm text-slate-600">Each leg is matched independently.</p></div>
        <ol className="space-y-2">{result.journey.segments.map((s, i) => {
          const r = result.results.find((x) => x.segmentId === s.id);
          return <li key={s.id} className="card flex items-center gap-3 p-4"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
            <div className="min-w-0 flex-1"><div className="font-bold">{short(s.origin.name)} → {short(s.dest.name)}</div><div className="text-xs text-slate-500">{MODE_LABEL[s.mode as keyof typeof MODE_LABEL]} · {r?.error ? <span className="text-red-600">{r.error}</span> : r?.action === 'JOINED' ? 'Matched into an existing crew' : r?.action === 'HOSTED' ? 'Hosting a new crew' : 'Saved — find a crew'}</div></div>
            {r?.groupId ? <Link href={`/trips/${r.groupId}`} className="btn-primary btn-sm">Open</Link> : <Link href={`/journeys/${result.journey.id}`} className="btn-secondary btn-sm">Find crew</Link>}</li>;
        })}</ol>
        <Link href={`/journeys/${result.journey.id}`} className="btn-secondary w-full">View whole journey</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Plan a trip</h1><p className="text-sm text-slate-600">One leg or a chained journey (cab → train → auto). Public pickup points only — never home addresses.</p></div>
      <Field label="Journey name (optional)"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Home for the break" /></Field>

      {L.map((l, i) => {
        const spec = l.mode === 'CAB' ? VEHICLE_SPECS[l.vehicleType as 'SEDAN4' | 'SUV6'] : l.mode === 'AUTO' ? VEHICLE_SPECS.AUTO : null;
        const maxBags = Math.min(3, spec?.bags ?? 3);
        return (
          <section key={i} className="card space-y-4 p-4 sm:p-5" aria-label={`Leg ${i + 1}`}>
            <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span><h2 className="font-bold text-slate-900">Leg {i + 1}{l.originId && l.destId ? `: ${placeName(l.originId)} → ${placeName(l.destId)}` : ''}</h2>
              {L.length > 1 && <button className="btn-ghost btn-sm ml-auto text-red-600" onClick={() => setLegs(L.filter((_, k) => k !== i))} aria-label={`Remove leg ${i + 1}`}><Trash2 className="h-4 w-4" /></button>}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From (pickup)"><PlaceSelect places={places} value={l.originId} onChange={(v) => update(i, { originId: v })} exclude={l.destId} label="From" /></Field>
              <Field label="To"><PlaceSelect places={places} value={l.destId} onChange={(v) => update(i, { destId: v })} exclude={l.originId} label="To" /></Field>
              <Field label="Date"><input type="date" className="input" min={meta.data!.today} value={l.date} onChange={(e) => update(i, { date: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Window start"><input type="time" className="input" value={l.windowStart} onChange={(e) => update(i, { windowStart: e.target.value })} /></Field><Field label="Window end"><input type="time" className="input" value={l.windowEnd} onChange={(e) => update(i, { windowEnd: e.target.value })} /></Field></div>
            </div>
            <div><span className="label">Mode</span><div className="flex flex-wrap gap-2">{MODES.map((m) => (
              <button key={m} type="button" onClick={() => update(i, { mode: m, vehicleType: m === 'CAB' ? 'SEDAN4' : m === 'AUTO' ? 'AUTO' : 'SHARED', luggage: Math.min(l.luggage, m === 'AUTO' ? 3 : 3) })} className={`rounded-xl border px-3.5 py-2 text-sm font-semibold ${l.mode === m ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`} aria-pressed={l.mode === m}>{MODE_LABEL[m]}</button>))}</div></div>
            <div className="grid gap-4 sm:grid-cols-3">
              {l.mode === 'CAB' && <Field label="Vehicle"><select className="input" value={l.vehicleType} onChange={(e) => update(i, { vehicleType: e.target.value, luggage: Math.min(l.luggage, 3) })}><option value="SEDAN4">4-seater sedan (max 4 bags)</option><option value="SUV6">6-seater SUV (max 6 bags)</option></select></Field>}
              <Field label={`Luggage (0–3)${spec ? ` · cab fits ${spec.bags}` : ''}`}><select className="input" value={l.luggage} onChange={(e) => update(i, { luggage: Number(e.target.value) })}>{Array.from({ length: maxBags + 1 }, (_, n) => <option key={n} value={n}>{n} bag{n === 1 ? '' : 's'}</option>)}</select></Field>
              <Field label="Crew type" hint={prefs.length === 1 ? 'Gender-specific trips are only offered to matching profiles' : 'Hard filter: others never see your gendered crew'}><select className="input" value={l.genderPref} onChange={(e) => update(i, { genderPref: e.target.value })}>{prefs.map((p) => <option key={p} value={p}>{GENDER_PREF_LABEL[p as keyof typeof GENDER_PREF_LABEL]}</option>)}</select></Field>
              {l.mode === 'TRAIN' && <Field label="Train number" hint="Printed on your ticket"><input className="input font-mono" value={l.trainNumber} onChange={(e) => update(i, { trainNumber: e.target.value })} maxLength={5} placeholder="5-digit train no." /></Field>}
              {l.mode === 'FLIGHT' && <Field label="Flight number"><input className="input font-mono uppercase" value={l.flightNumber} onChange={(e) => update(i, { flightNumber: e.target.value.toUpperCase() })} placeholder="6E-2134" maxLength={8} /></Field>}
              {(l.mode === 'CAB' || l.mode === 'AUTO') && <Field label="Linked train (optional)"><input className="input font-mono" value={l.trainNumber} onChange={(e) => update(i, { trainNumber: e.target.value })} maxLength={5} placeholder="optional" /></Field>}
            </div>
            {l.windowStart >= '21:00' && <p className="rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-800">🌙 After 21:00 → Night Safety Mode: same-hostel & high-trust matches are boosted. Requires Trust Score 70+ (yours: {user.trustScore}).</p>}
          </section>
        );
      })}

      {L.length < 4 && <button type="button" className="btn-secondary w-full" onClick={addLeg}><Plus className="h-4 w-4" />Add next leg (chain journey)</button>}
      {err && <ErrorBox message={err} />}
      <div className="sticky bottom-20 z-20 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row md:bottom-4">
        <button className="btn-primary flex-1" disabled={!!busy} onClick={() => submit(true)}><Sparkles className="h-4 w-4" />{busy === 'match' ? 'Matching…' : 'Find my crew (auto-match)'}</button>
        <button className="btn-secondary flex-1" disabled={!!busy} onClick={() => submit(false)}><Link2 className="h-4 w-4" />{busy === 'save' ? 'Saving…' : 'Save plan & choose manually'}<ArrowRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<PageLoader />}><NewTrip /></Suspense>;
}
