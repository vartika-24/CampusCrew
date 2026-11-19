'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertOctagon, ArrowRight, BadgeCheck, Briefcase, Car, CheckCircle2, Clock, Copy, ExternalLink, Flag, KeyRound, LogOut, Phone, PlayCircle, Repeat, Share2, ShieldAlert, Star, TimerReset, Users } from 'lucide-react';
import { useAuth, useToast } from '@/components/Providers';
import { Chat } from '@/components/Chat';
import { FareCard } from '@/components/FareCard';
import { RouteMap } from '@/components/RouteMap';
import { Avatar, ErrorBox, GenderBadge, Modal, ModeBadge, NightBadge, PageLoader, StatusPill, TrustBadge } from '@/components/ui';
import { api, fmtDate, type Member, type Trip } from '@/lib/client';
import { useData } from '@/lib/useData';
import { REPORT_TYPES, REPORT_TYPE_LABEL } from '@/lib/constants';
import { LocationSharer } from '@/components/LocationSharer';

type Track = { source: 'GPS' | 'SIMULATED' | 'NONE'; progress: number; etaRemaining: number; etaMinutes: number; position: { lat: number; lng: number } | null; trail: { lat: number; lng: number }[]; lastSeenAt: string | null; route: { lat: number; lng: number }[]; origin: { name: string }; dest: { name: string }; state: string };
const short = (n: string) => n.split(' (')[0];

export default function TripRoom({ params }: { params: { id: string } }) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const d = useData<{ trip: Trip; rated: string[] }>(`/api/groups/${params.id}`, { poll: 6000 });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | 'sos' | 'sosDone' | 'return' | 'report' | 'leave' | 'join'>(null);
  const [lug, setLug] = useState(0);
  const [sosInfo, setSosInfo] = useState<{ lat: number; lng: number; approximate?: boolean; helplines: { label: string; number: string }[] } | null>(null);
  const [pin, setPin] = useState('');
  const [reportFor, setReportFor] = useState<Member | null>(null);
  const [rep, setRep] = useState({ type: 'DISPUTE', description: '' });
  const [ret, setRet] = useState({ date: '', windowStart: '', windowEnd: '', trainNumber: '' });
  const [delayMin, setDelayMin] = useState(25);

  const trip = d.data?.trip;
  const track = useTrack(trip?.isMember ? trip.shareToken : null, trip?.status === 'IN_PROGRESS' ? 3000 : 12000);

  useEffect(() => {
    if (trip && !ret.date) {
      api<{ settings: Record<string, string> }>('/api/meta').then((m) => setRet({ date: m.settings.returnDate ?? '', windowStart: trip.windowStart, windowEnd: trip.windowEnd, trainNumber: trip.trainNumber ?? '' })).catch(() => undefined);
    }
  }, [trip, ret.date]);

  if (d.loading && !d.data) return <PageLoader text="Opening trip room…" />;
  if (d.error && !d.data) return <ErrorBox message={d.error} onRetry={d.reload} />;
  if (!trip || !user) return null;

  const live = trip.status === 'IN_PROGRESS';
  const ended = trip.status === 'COMPLETED' || trip.status === 'CANCELLED';
  const joined = trip.members.filter((m) => m.status === 'JOINED');
  const waiting = trip.members.filter((m) => m.status === 'WAITLIST');
  const reload = () => { d.reload(); void refresh(); };
  const run = async (fn: () => Promise<unknown>, okMsg?: string, after?: () => void) => {
    setBusy(true);
    try { await fn(); if (okMsg) toast.push('success', okMsg); reload(); after?.(); } catch (e) { toast.push('error', (e as Error).message); } finally { setBusy(false); }
  };
  const post = (path: string, body: unknown = {}) => api(`/api/groups/${trip.id}/${path}`, { body });
  const shareUrl = trip.shareToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${trip.shareToken}` : '';

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.push('success', 'Live-trip link copied — send it to parents or friends.'); }
    catch { toast.push('info', shareUrl); }
  }

  async function sos() {
    setBusy(true);
    try {
      // Best effort: send this device's GPS with the SOS (falls back to the last shared position / pickup point on the server).
      const gps = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!('geolocation' in navigator)) return resolve(null);
        navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 4000, maximumAge: 15000 });
      });
      const r = await api<{ alert: { lat: number; lng: number; approximate: boolean }; helplines: { label: string; number: string }[] }>(`/api/groups/${trip!.id}/sos`, { body: gps ?? {} });
      setSosInfo({ ...r.alert, helplines: r.helplines }); setModal('sosDone'); reload();
    }
    catch (e) { toast.push('error', (e as Error).message); setModal(null); } finally { setBusy(false); }
  }

  async function leave() {
    setModal(null);
    await run(async () => {
      const r = await post('leave') as { penalty: string; waived: boolean; groupCancelled: boolean };
      toast.push(r.penalty === 'LATE' ? 'error' : 'success', r.waived ? 'You left penalty-free because the trip was delayed.' : r.penalty === 'LATE' ? 'You left at the last minute: −15 trust points.' : r.penalty === 'REGULAR' ? 'You left a confirmed crew: −5 trust points.' : 'You left the crew.');
      router.push('/trips?tab=mine');
    });
  }

  const routeTitle = `${short(trip.origin.name)} → ${short(trip.dest.name)}`;
  const canBoard = trip.isMember && !trip.me?.boarded && !ended;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5"><StatusPill status={trip.status} /><ModeBadge mode={trip.mode} /><GenderBadge pref={trip.genderPref} />{trip.nightMode && <NightBadge />}
          {trip.trainNumber && <span className="chip">Train {trip.trainNumber}</span>}{trip.flightNumber && <span className="chip">Flight {trip.flightNumber}</span>}{trip.parentGroupId && <span className="chip">↩ Return sync</span>}</div>
        <h1 className="mt-2 flex flex-wrap items-center gap-2 text-xl font-extrabold text-slate-900 sm:text-2xl"><span>{short(trip.origin.name)}</span><ArrowRight className="h-5 w-5 text-slate-400" /><span>{short(trip.dest.name)}</span></h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{fmtDate(trip.date)} · {trip.windowStart}–{trip.windowEnd}</span>
          <span className="flex items-center gap-1"><Users className="h-4 w-4" />{joined.length}/{trip.seats} riders · host {trip.hostName}</span>
          <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" />{trip.bagsUsed}/{trip.bagCapacity >= 99 ? '∞' : trip.bagCapacity} bags · {trip.vehicleLabel}</span>
          <span>{trip.km} km</span>
        </div>
        {trip.delayMins > 0 && !ended && <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><TimerReset className="mt-0.5 h-4 w-4 shrink-0" /><span><b>Delayed by {trip.delayMins} min.</b> Pickup window shifted to {trip.windowStart}–{trip.windowEnd}. You can leave or re-group without penalty.</span></div>}
        {trip.myStatus === 'WAITLIST' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><b>You&apos;re on the waitlist.</b> If a rider cancels, the best-matching waitlisted student is promoted automatically and fares are recalculated.</div>}
      </div>

      {!trip.isMember && (
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1 text-sm text-slate-600">{trip.myStatus === 'WAITLIST' ? 'Waiting for a seat…' : ended ? 'This trip has ended.' : <>Join to unlock the chat, verified vehicle details, PIN and fare split. {trip.operatorPreview && <span className="text-slate-500">({trip.operatorPreview.vehicleName})</span>}</>}</div>
          {trip.myStatus === 'WAITLIST' ? <button className="btn-secondary" onClick={() => run(() => post('leave'), 'Left the waitlist', () => router.push('/trips'))}>Leave waitlist</button>
            : !ended && <button className="btn-primary" onClick={() => { setLug(0); setModal('join'); }}>{trip.seatsLeft > 0 ? 'Join this crew' : 'Join waitlist'}</button>}
        </div>
      )}

      {trip.isMember && !ended && (
        <button onClick={() => setModal('sos')} className="flex w-full animate-sos items-center justify-center gap-3 rounded-2xl bg-red-600 py-3.5 text-lg font-extrabold text-white shadow-lg active:scale-[.99] lg:hidden" data-testid="sos-button-mobile"><ShieldAlert className="h-6 w-6" />SOS — Emergency</button>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          {/* Live tracking */}
          {trip.isMember && track && !trip.status.includes('CANCELLED') && (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-900">{live && <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />}Live trip sharing</h3>
                <span className="text-xs font-semibold text-slate-500">{track.state === 'ARRIVED' ? 'Arrived' : live ? `ETA ${track.etaRemaining} min` : `~${track.etaMinutes} min ride`}</span></div>
              <RouteMap route={track.route} position={track.position} trail={track.trail} origin={short(trip.origin.name)} dest={short(trip.dest.name)} progress={track.progress} vehicleLabel={trip.operator?.plate} />
              {live && track.source === 'NONE' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">No live location yet. A rider needs to tap <b>Share my live location</b> below so family can follow the trip.</p>}
              {track.source === 'SIMULATED' && <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">Demo mode: position is simulated.</p>}
              {trip.isMember && <LocationSharer groupId={trip.id} live={live} />}
              <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand-600 transition-all duration-1000" style={{ width: `${Math.round(track.progress * 100)}%` }} /></div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary btn-sm" onClick={copyLink}><Copy className="h-3.5 w-3.5" />Copy parent link</button>
                <a className="btn-secondary btn-sm" href={`/track/${trip.shareToken}`} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Preview public view</a>
                {typeof navigator !== 'undefined' && 'share' in navigator && <button className="btn-secondary btn-sm" onClick={() => navigator.share({ title: 'Track my CampusCrew trip', url: shareUrl }).catch(() => undefined)}><Share2 className="h-3.5 w-3.5" />Share</button>}
                <button className="btn-ghost btn-sm" onClick={() => run(() => post('share', { rotate: true }), 'Old link revoked, new link created')}>Revoke & renew link</button>
              </div>
              <p className="text-xs text-slate-500">Anyone with the link sees a read-only view: route progress, plate and verified co-rider names. No login, no phone numbers, no seats.</p>
            </div>
          )}

          {/* Vehicle + PIN */}
          {trip.isMember && (
            <div className="card space-y-3 p-4">
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><Car className="h-5 w-5 text-brand-600" />Verified vehicle & pickup PIN</h3>
              {trip.operator ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <Avatar name={trip.operator.name} size={44} />
                  <div className="min-w-0 flex-1"><div className="font-bold text-slate-900">{trip.operator.name} · {trip.operator.vehicleName}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm"><span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white" data-testid="plate">{trip.operator.plate}</span><span className="text-amber-600">★ {trip.operator.rating}</span><span className="flex items-center gap-1 text-slate-500"><Phone className="h-3 w-3" />{trip.operator.phoneMasked}</span></div></div>
                  <span className="badge bg-emerald-50 text-emerald-700"><BadgeCheck className="h-3 w-3" />{trip.operator.badge}</span>
                </div>
              ) : <p className="text-sm text-slate-600">Travelling by {trip.mode.toLowerCase()} — no vehicle operator. Meet the crew at the pickup point.</p>}

              {trip.pin && <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50 p-3 text-center"><div className="text-xs font-bold uppercase tracking-wide text-brand-700">Trip PIN — share with the driver at pickup</div><div className="mt-1 font-mono text-4xl font-extrabold tracking-[0.4em] text-brand-900" data-testid="trip-pin">{trip.pin}</div></div>}
              {trip.demoPin && !trip.me?.boarded && <p className="rounded-lg bg-amber-50 p-2 text-center text-xs text-amber-800">Demo mode hint: the driver would show PIN <b className="font-mono text-sm">{trip.demoPin}</b></p>}
              {trip.me?.boarded ? <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><CheckCircle2 className="h-5 w-5" />Boarding confirmed with PIN</div>
                : canBoard && (
                  <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void run(() => post('board', { pin }), 'Boarding confirmed ✅', () => setPin('')); }}>
                    <input className="input text-center font-mono text-lg tracking-[0.4em]" inputMode="numeric" maxLength={4} placeholder="• • • •" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="4-digit trip PIN" />
                    <button className="btn-primary whitespace-nowrap" disabled={pin.length !== 4 || busy}><KeyRound className="h-4 w-4" />Confirm Boarding with PIN</button>
                  </form>)}
            </div>
          )}

          {/* Host controls */}
          {trip.isHost && !ended && (
            <div className="card space-y-3 p-4">
              <h3 className="font-bold text-slate-900">Host controls</h3>
              <div className="flex flex-wrap gap-2">
                {trip.status === 'OPEN' && <button className="btn-primary btn-sm" disabled={busy || joined.length < 2} onClick={() => run(() => post('status', { action: 'confirm' }), 'Crew confirmed')}>Confirm crew</button>}
                {(trip.status === 'OPEN' || trip.status === 'CONFIRMED') && <button className="btn-eco btn-sm" disabled={busy} onClick={() => run(() => post('status', { action: 'start' }), 'Ride started')}><PlayCircle className="h-4 w-4" />Start ride</button>}
                {live && <button className="btn-eco btn-sm" disabled={busy} onClick={() => run(() => post('status', { action: 'complete' }), 'Trip completed 🎉')}><CheckCircle2 className="h-4 w-4" />Complete trip</button>}
                {live && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => run(() => post('status', { action: 'restart' }), 'Simulation restarted')}>Restart live simulation</button>}
                {(trip.status === 'OPEN' || trip.status === 'CONFIRMED') && <button className="btn-ghost btn-sm text-red-600" disabled={busy} onClick={() => confirm('Cancel this trip for everyone?') && run(() => post('status', { action: 'cancel' }), 'Trip cancelled')}>Cancel trip</button>}
              </div>
              {trip.status === 'OPEN' && joined.length < 2 && <p className="text-xs text-slate-500">Need at least 2 riders to confirm. Starting needs someone to confirm boarding with the PIN first.</p>}
            </div>
          )}

          {trip.isMember && !ended && (
            <div className="card space-y-3 p-4">
              <h3 className="font-bold text-slate-900">Delay handler</h3>
              <div className="flex flex-wrap items-center gap-2">
                <select className="input !w-auto" value={delayMin} onChange={(e) => setDelayMin(Number(e.target.value))} aria-label="Delay minutes">{[15, 25, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
                <button className="btn-warn btn-sm" disabled={busy || live} onClick={() => run(() => post('delay', { minutes: delayMin }), 'Delay broadcast to the crew')}><TimerReset className="h-4 w-4" />Simulate {trip.trainNumber ? 'train' : trip.flightNumber ? 'flight' : 'ride'} delay</button>
              </div>
              <p className="text-xs text-slate-500">Alerts the group chat, shifts the pickup window and lets riders exit or re-group with no trust penalty.</p>
            </div>
          )}

          {trip.status === 'COMPLETED' && trip.isMember && <RateCard trip={trip} meId={user.id} rated={d.data!.rated} reload={reload} />}
          {trip.isMember && trip.status !== 'CANCELLED' && <FareCard trip={trip} meId={user.id} reload={reload} />}
        </div>

        <div className="space-y-5 lg:col-span-2">
          {trip.isMember && !ended && (
            <button onClick={() => setModal('sos')} className="hidden w-full animate-sos lg:flex items-center justify-center gap-3 rounded-2xl bg-red-600 py-4 text-lg font-extrabold text-white shadow-lg hover:bg-red-700 active:scale-[.99]" data-testid="sos-button"><ShieldAlert className="h-6 w-6" />SOS — Emergency</button>
          )}
          {trip.isMember && <Chat groupId={trip.id} meId={user.id} onState={d.silentReload} />}

          <div className="card p-4">
            <h3 className="mb-2 font-bold text-slate-900">Crew ({joined.length}/{trip.seats})</h3>
            <ul className="space-y-2.5">
              {joined.map((m) => <MemberRow key={m.userId} m={m} trip={trip} meId={user.id} onReport={() => { setReportFor(m); setRep({ type: 'DISPUTE', description: '' }); setModal('report'); }} />)}
              {trip.seatsLeft > 0 && !ended && Array.from({ length: Math.min(trip.seatsLeft, 3) }).map((_, i) => <li key={i} className="flex items-center gap-3 text-sm text-slate-400"><span className="grid h-9 w-9 place-items-center rounded-full border-2 border-dashed border-slate-300">+</span>Open seat</li>)}
            </ul>
            {waiting.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3"><div className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-700">Waitlist</div><ul className="space-y-1.5">{waiting.map((m, i) => <li key={m.userId} className="flex items-center gap-2 text-sm"><span className="chip">#{i + 1}</span><span className="font-medium">{m.firstName}</span><TrustBadge score={m.trustScore} /></li>)}</ul></div>}
          </div>

          {trip.isMember && (
            <div className="card space-y-2 p-4">
              {trip.status !== 'CANCELLED' && <button className="btn-secondary w-full" disabled={busy} onClick={() => setModal('return')}><Repeat className="h-4 w-4" />One-tap return sync</button>}
              {!ended && !live && <button className="btn-ghost w-full text-red-600" onClick={() => setModal('leave')}><LogOut className="h-4 w-4" />Leave this crew</button>}
              <button className="btn-ghost w-full" onClick={() => { setReportFor(null); setRep({ type: 'OTHER', description: '' }); setModal('report'); }}><Flag className="h-4 w-4" />Report an issue</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Modal open={modal === 'join'} onClose={() => setModal(null)} title="Join this crew">
        <div className="space-y-4"><div><span className="label">How many bags?</span><div className="grid grid-cols-4 gap-2">{[0, 1, 2, 3].map((n) => <button key={n} onClick={() => setLug(n)} className={`rounded-xl border py-2.5 text-sm font-bold ${lug === n ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300'}`}>{n}</button>)}</div></div>
          <button className="btn-primary w-full" disabled={busy} onClick={() => run(async () => { const r = await api<{ status: string }>(`/api/groups/${trip.id}/join`, { body: { luggage: lug } }); toast.push('success', r.status === 'WAITLIST' ? 'Added to the waitlist' : 'You joined the crew! 🎉'); setModal(null); })}>Confirm</button></div>
      </Modal>

      <Modal open={modal === 'sos'} onClose={() => setModal(null)} title="Send emergency SOS?">
        <div className="space-y-4"><p className="text-sm text-slate-700">This immediately alerts <b>IIITA Campus Security</b> and your crew with your live location. Use it only in a real emergency.</p>
          <div className="grid grid-cols-2 gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Cancel</button><button className="btn-danger" onClick={sos} disabled={busy} data-testid="sos-confirm"><AlertOctagon className="h-4 w-4" />Send SOS now</button></div></div>
      </Modal>

      <Modal open={modal === 'sosDone'} onClose={() => setModal(null)} title="SOS sent — help is alerted">
        <div className="space-y-3"><div className="rounded-xl bg-red-50 p-3 text-sm text-red-900"><b>Campus Security has been notified</b>{sosInfo?.approximate ? ' (exact location unavailable — the pickup point was sent; tell them where you are).' : ` with your location (${sosInfo ? `${sosInfo.lat.toFixed(4)}, ${sosInfo.lng.toFixed(4)}` : '…'}).`} Stay safe and keep your crew close.</div>
          <ul className="space-y-2">{(sosInfo?.helplines ?? []).map((h) => <li key={h.number}><a href={`tel:${h.number.replace(/[^\d]/g, '')}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50"><span className="text-sm font-medium">{h.label}</span><span className="flex items-center gap-1 font-mono font-bold text-red-600"><Phone className="h-4 w-4" />{h.number}</span></a></li>)}</ul></div>
      </Modal>

      <Modal open={modal === 'leave'} onClose={() => setModal(null)} title="Leave this crew?">
        <div className="space-y-3 text-sm text-slate-700"><p>{trip.delayMins > 0 ? 'This trip was delayed, so you can leave penalty-free. You can re-group with another crew afterwards.' : 'Leaving a confirmed crew costs 5 trust points; leaving within 3 hours of departure costs 15. Your seat goes to the top waitlisted student and everyone’s fare split is recalculated.'}</p>
          <div className="grid grid-cols-2 gap-2"><button className="btn-secondary" onClick={() => setModal(null)}>Stay</button><button className="btn-danger" onClick={leave} disabled={busy}>Leave crew</button></div></div>
      </Modal>

      <Modal open={modal === 'return'} onClose={() => setModal(null)} title="Return-trip sync">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(async () => { const r = await api<{ groupId: string; added: string[]; skipped: { name: string; reason: string }[] }>(`/api/groups/${trip.id}/return`, { body: ret }); toast.push('success', `Return crew created with ${r.added.length + 1} rider(s)${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`); setModal(null); router.push(`/trips/${r.groupId}`); }); }}>
          <p className="text-sm text-slate-600">Clones this crew and reverses the route: <b>{short(trip.dest.name)} → {short(trip.origin.name)}</b>.</p>
          <label className="block"><span className="label">Return date</span><input type="date" className="input" value={ret.date} onChange={(e) => setRet({ ...ret, date: e.target.value })} required /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block"><span className="label">From</span><input type="time" className="input" value={ret.windowStart} onChange={(e) => setRet({ ...ret, windowStart: e.target.value })} required /></label><label className="block"><span className="label">To</span><input type="time" className="input" value={ret.windowEnd} onChange={(e) => setRet({ ...ret, windowEnd: e.target.value })} required /></label></div>
          {trip.mode === 'TRAIN' && <label className="block"><span className="label">Return train no.</span><input className="input font-mono" maxLength={5} value={ret.trainNumber} onChange={(e) => setRet({ ...ret, trainNumber: e.target.value })} /></label>}
          <button className="btn-primary w-full" disabled={busy}><Repeat className="h-4 w-4" />Sync return crew</button>
        </form>
      </Modal>

      <Modal open={modal === 'report'} onClose={() => setModal(null)} title="Report to Campus Safety">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void run(() => post('report', { ...rep, targetId: reportFor?.userId }), 'Report sent to Student Affairs', () => setModal(null)); }}>
          {reportFor && <p className="text-sm text-slate-600">About <b>{reportFor.firstName}</b></p>}
          {!reportFor && joined.length > 1 && <label className="block"><span className="label">About (optional)</span><select className="input" onChange={(e) => setReportFor(joined.find((m) => m.userId === e.target.value) ?? null)} defaultValue=""><option value="">General / no one in particular</option>{joined.filter((m) => m.userId !== user.id).map((m) => <option key={m.userId} value={m.userId}>{m.firstName}</option>)}</select></label>}
          <label className="block"><span className="label">Type</span><select className="input" value={rep.type} onChange={(e) => setRep({ ...rep, type: e.target.value })}>{REPORT_TYPES.map((r) => <option key={r} value={r}>{REPORT_TYPE_LABEL[r]}</option>)}</select></label>
          <label className="block"><span className="label">What happened?</span><textarea className="input min-h-24" value={rep.description} onChange={(e) => setRep({ ...rep, description: e.target.value })} minLength={10} maxLength={800} required /></label>
          <button className="btn-primary w-full" disabled={busy || rep.description.length < 10}>Submit report</button>
        </form>
      </Modal>
    </div>
  );
}

function useTrack(token: string | null, every: number) {
  const [t, setT] = useState<Track | null>(null);
  useEffect(() => {
    if (!token) return;
    let live = true;
    const load = () => api<Track>(`/api/track/${token}`).then((x) => live && setT(x)).catch(() => undefined);
    void load();
    const id = setInterval(load, every);
    return () => { live = false; clearInterval(id); };
  }, [token, every]);
  return t;
}

function MemberRow({ m, trip, meId, onReport }: { m: Member; trip: Trip; meId: string; onReport: () => void }) {
  return (
    <li className="flex items-center gap-3">
      <Avatar name={m.firstName} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-900">{m.name}{m.userId === meId && <span className="text-xs text-slate-400">(you)</span>}{m.isHost && <span className="badge bg-brand-50 text-brand-700">Host</span>}{m.verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-label="Verified" />}</div>
        <div className="truncate text-xs text-slate-500">{m.department} · Y{m.year}{m.hostel ? ` · ${m.hostel}` : ''} · {m.luggage} bag{m.luggage === 1 ? '' : 's'}</div>
      </div>
      <div className="flex flex-col items-end gap-1"><TrustBadge score={m.trustScore} />{m.boarded && <span className="badge bg-sky-50 text-sky-700">Boarded</span>}</div>
      {trip.isMember && m.userId !== meId && <button className="btn-ghost !p-1.5" onClick={onReport} aria-label={`Report ${m.firstName}`}><Flag className="h-3.5 w-3.5" /></button>}
    </li>
  );
}

function RateCard({ trip, meId, rated, reload }: { trip: Trip; meId: string; rated: string[]; reload: () => void }) {
  const toast = useToast();
  const riders = trip.members.filter((m) => m.status === 'JOINED' && m.boarded && m.userId !== meId && !rated.includes(m.userId));
  const [scores, setScores] = useState<Record<string, number>>({});
  if (!trip.me?.boarded || riders.length === 0) return null;
  async function rate(id: string, punctual: boolean) {
    try { await api(`/api/groups/${trip.id}/rate`, { body: { rateeId: id, score: scores[id] ?? 5, punctual } }); toast.push('success', 'Thanks for rating!'); reload(); } catch (e) { toast.push('error', (e as Error).message); }
  }
  return (
    <div className="card space-y-3 p-4"><h3 className="font-bold text-slate-900">Rate your co-riders</h3>
      <ul className="space-y-3">{riders.map((m) => (
        <li key={m.userId} className="flex flex-wrap items-center gap-3"><Avatar name={m.firstName} size={32} /><span className="min-w-16 flex-1 text-sm font-semibold">{m.firstName}</span>
          <span className="flex">{[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setScores({ ...scores, [m.userId]: s })} aria-label={`${s} stars`}><Star className={`h-5 w-5 ${(scores[m.userId] ?? 5) >= s ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} /></button>)}</span>
          <button className="btn-secondary btn-sm" onClick={() => rate(m.userId, true)}>On time ✓</button><button className="btn-ghost btn-sm" onClick={() => rate(m.userId, false)}>Late</button></li>))}</ul></div>
  );
}
