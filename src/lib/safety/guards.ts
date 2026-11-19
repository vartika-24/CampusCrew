import { db } from '../db';
import { forbidden } from '../api';
import { TRUST_MIN_NIGHT } from '../constants';
import { isNightWindow, type Window } from '../matching/scoring';
import { computeTrust } from './trust';

/** Re-computes and persists a user's trust score from their counters + open reports. */
export async function recomputeTrust(userId: string): Promise<number> {
  const u = await db.user.findUnique({ where: { id: userId } });
  if (!u) return 0;
  const unresolvedReports = await db.report.count({ where: { targetId: userId, status: 'OPEN' } });
  const score = computeTrust({
    verified: u.emailVerified && u.idCardStatus === 'VERIFIED',
    completedRides: u.completedRides,
    ratingSum: u.ratingSum,
    ratingCount: u.ratingCount,
    punctualCount: u.punctualCount,
    cancelCount: u.cancelCount,
    lateCancels: u.lateCancels,
    unresolvedReports,
    adminAdjust: u.trustAdjust,
  });
  if (score !== u.trustScore) await db.user.update({ where: { id: userId }, data: { trustScore: score } });
  return score;
}

export type Dues = { groupId: string; amount: number; route: string }[];

/** Unsettled fare shares from completed trips (the booking lock). */
export async function outstandingDues(userId: string): Promise<Dues> {
  const rows = await db.groupMember.findMany({
    where: {
      userId, status: 'JOINED', boarded: true, paymentStatus: 'UNPAID', shareAmount: { gt: 0 },
      group: { status: 'COMPLETED', creatorId: { not: userId } },
    },
    include: { group: true },
  });
  if (rows.length === 0) return [];
  const places = await db.place.findMany({ where: { id: { in: rows.flatMap((r) => [r.group.originId, r.group.destId]) } } });
  const name = (id: string) => places.find((p) => p.id === id)?.name ?? '';
  return rows.map((r) => ({ groupId: r.groupId, amount: r.shareAmount, route: `${name(r.group.originId)} → ${name(r.group.destId)}` }));
}

export async function assertNoDues(userId: string) {
  const dues = await outstandingDues(userId);
  if (dues.length) {
    const total = dues.reduce((s, d) => s + d.amount, 0);
    throw forbidden(`Booking locked: you have ₹${total} unsettled from a past trip. Settle it to book again.`, 'DUES_PENDING', { dues });
  }
}

export function assertNightAllowed(user: { trustScore: number }, window: Window) {
  if (isNightWindow(window) && user.trustScore < TRUST_MIN_NIGHT) {
    throw forbidden(`Late-night rides (after 21:00) need a Trust Score of ${TRUST_MIN_NIGHT}+. Yours is ${user.trustScore}.`, 'NIGHT_RESTRICTED');
  }
}
