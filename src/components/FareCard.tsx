'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, IndianRupee, QrCode, Smartphone } from 'lucide-react';
import { api, rupees, type Trip } from '@/lib/client';
import { splitFare } from '@/lib/fare';
import { useToast } from './Providers';
import { Modal } from './ui';

export function FareCard({ trip, meId, reload }: { trip: Trip; meId: string; reload: () => void }) {
  const toast = useToast();
  const [total, setTotal] = useState(trip.fareTotal != null ? String(trip.fareTotal) : '');
  const [qr, setQr] = useState(false);
  const [busy, setBusy] = useState(false);
  const joined = trip.members.filter((m) => m.status === 'JOINED');
  const counted = trip.status === 'COMPLETED' ? joined.filter((m) => m.boarded) : joined;
  const preview = Number(total) >= 0 && total !== '' ? splitFare(Number(total), counted.length || 1, trip.feePerRider) : null;
  const me = trip.me;

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); toast.push('success', ok); reload(); } catch (e) { toast.push('error', (e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center gap-2"><IndianRupee className="h-5 w-5 text-emerald-600" /><h3 className="font-bold text-slate-900">Fare split & UPI settlement</h3></div>

      {trip.isHost && trip.status !== 'CANCELLED' && (
        <div className="space-y-2">
          <label className="label" htmlFor="fare">Actual total fare (₹) — you pay the driver</label>
          <div className="flex gap-2">
            <input id="fare" className="input" inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ''))} aria-label="Total fare in rupees" placeholder="e.g. 1200" />
            <button className="btn-eco whitespace-nowrap" disabled={busy || total === ''} onClick={() => run(() => api(`/api/groups/${trip.id}/fare`, { body: { total: Number(total) } }), 'Fare split updated')}>Split fare</button>
          </div>
          {!trip.upiPayee?.upiId && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Add your UPI ID in Profile so riders can pay you.</p>}
        </div>
      )}

      {(preview || trip.split) && (
        <div className="rounded-xl bg-emerald-50 p-3 text-sm">
          {(() => { const s = trip.fareTotal != null && trip.split ? trip.split : preview!; return (
            <>
              <div className="flex items-baseline justify-between"><span className="text-emerald-900">Each of {s.riders} rider{s.riders > 1 ? 's' : ''} pays</span><span className="text-2xl font-extrabold text-emerald-700">{rupees(s.perRider)}</span></div>
              <div className="mt-1 text-xs text-emerald-800">{rupees(s.total)} ÷ {s.riders} = {rupees(s.baseShare)} + {rupees(s.fee)} platform fee</div>
            </>); })()}
        </div>
      )}
      {trip.fareTotal == null && !trip.isHost && <p className="text-sm text-slate-500">The host will enter the actual fare once known. Your share is then calculated automatically.</p>}

      {trip.fareTotal != null && !trip.isHost && me && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Pay <b>{trip.upiPayee?.name.split(' ')[0]}</b> ({trip.upiPayee?.upiId ?? 'no UPI ID'})</span>
            <span className={`badge ${me.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{me.paymentStatus}</span></div>
          {me.paymentStatus !== 'PAID' && trip.upi && (
            <div className="grid grid-cols-2 gap-2">
              <a href={trip.upi} className="btn-primary" data-testid="upi-link"><Smartphone className="h-4 w-4" />Pay {rupees(me.shareAmount)} via UPI</a>
              <button className="btn-secondary" onClick={() => setQr(true)}><QrCode className="h-4 w-4" />Show QR</button>
            </div>)}
          {me.paymentStatus !== 'PAID' && <button className="btn-eco w-full" disabled={busy} onClick={() => run(() => api(`/api/groups/${trip.id}/payments`, { body: { status: 'PAID' } }), 'Marked as paid')}><CheckCircle2 className="h-4 w-4" />I&apos;ve paid</button>}
          {trip.status === 'COMPLETED' && me.paymentStatus !== 'PAID' && <p className="text-xs font-medium text-red-600">Settle this to keep booking new trips — unpaid dues lock your account.</p>}
        </div>
      )}

      {trip.fareTotal != null && (
        <ul className="divide-y divide-slate-100 text-sm" aria-label="Settlement status">
          {joined.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 py-2">
              <span className="font-medium text-slate-800">{m.firstName}{m.isHost && <span className="ml-1 text-xs text-slate-400">(payee)</span>}</span>
              <span className="flex items-center gap-2">{m.shareAmount ? <span className="text-slate-600">{rupees(m.shareAmount)}</span> : <span className="text-xs text-slate-400">no show</span>}
                <span className={`badge ${m.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>{m.paymentStatus ?? '—'}</span>
                {trip.isHost && !m.isHost && m.shareAmount ? <button className="btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api(`/api/groups/${trip.id}/payments`, { body: { userId: m.userId, status: m.paymentStatus === 'PAID' ? 'UNPAID' : 'PAID' } }), 'Updated')}>{m.paymentStatus === 'PAID' ? 'Undo' : 'Mark paid'}</button> : null}</span>
            </li>))}
        </ul>
      )}

      <Modal open={qr} onClose={() => setQr(false)} title="Scan to pay with any UPI app">
        {trip.upi && me && (<div className="flex flex-col items-center gap-3 py-2"><div className="rounded-2xl border bg-white p-4"><QRCodeSVG value={trip.upi} size={220} includeMargin /></div>
          <div className="text-center"><div className="text-2xl font-extrabold text-emerald-700">{rupees(me.shareAmount)}</div><div className="text-sm text-slate-500">to {trip.upiPayee?.name} · {trip.upiPayee?.upiId}</div></div>
          <code className="w-full break-all rounded-lg bg-slate-100 p-2 text-[11px] text-slate-600">{trip.upi}</code></div>)}
      </Modal>
    </div>
  );
}
