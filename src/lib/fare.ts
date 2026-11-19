import { PLATFORM_FEE } from './constants';

export type FareSplit = {
  total: number;
  riders: number;
  baseShare: number; // ceil(total / riders)
  fee: number;
  perRider: number; // baseShare + fee
  collected: number; // perRider × riders (>= total + fees)
};

/** Equal split with a flat per-rider platform fee. ₹1200 / 4 riders -> ₹300 + ₹5 = ₹305 each. */
export function splitFare(total: number, riders: number, fee = PLATFORM_FEE): FareSplit {
  if (!Number.isFinite(total) || total < 0) throw new Error('Invalid fare');
  const n = Math.max(1, Math.floor(riders));
  const baseShare = Math.ceil(total / n);
  const perRider = baseShare + fee;
  return { total, riders: n, baseShare, fee, perRider, collected: perRider * n };
}

export function upiLink(opts: { pa: string; pn: string; amount: number; note?: string }): string {
  const q = new URLSearchParams({
    pa: opts.pa,
    pn: opts.pn,
    am: String(opts.amount),
    cu: 'INR',
    tn: opts.note ?? 'CampusCrew',
  });
  return `upi://pay?${q.toString()}`;
}
