import { db } from '@/lib/db';
import { bad, handle, ok, oneOf, readJson, str } from '@/lib/api';
import { publicUser, requireUser } from '@/lib/auth';
import { getConfig } from '@/lib/settings';
import { trustBreakdown } from '@/lib/safety/trust';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const u = await requireUser();
  const unresolved = await db.report.count({ where: { targetId: u.id, status: 'OPEN' } });
  const breakdown = trustBreakdown({
    verified: u.emailVerified && u.idCardStatus === 'VERIFIED', completedRides: u.completedRides, ratingSum: u.ratingSum, ratingCount: u.ratingCount,
    punctualCount: u.punctualCount, cancelCount: u.cancelCount, lateCancels: u.lateCancels, unresolvedReports: unresolved, adminAdjust: u.trustAdjust,
  });
  return ok({ user: publicUser(u), breakdown, punctualCount: u.punctualCount, ratingCount: u.ratingCount });
});

/** Editable: hostel, UPI ID, buddy visibility. Gender (and name/roll) are immutable once verified. */
export const PATCH = handle(async (req) => {
  const u = await requireUser();
  const body = await readJson(req);
  if ('gender' in body && body.gender !== u.gender) throw bad('Gender is locked after verification and cannot be changed. Contact Student Affairs if it is incorrect.', 'GENDER_LOCKED');
  for (const k of ['rollNumber', 'email', 'role', 'trustScore', ...(u.role === 'ADMIN' ? [] : ['name'])]) if (k in body && body[k] !== (u as unknown as Record<string, unknown>)[k]) throw bad(`${k} cannot be edited`, 'IMMUTABLE');
  const data: Record<string, unknown> = {};
  if (body.hostel !== undefined) {
    const cfg = await getConfig();
    data.hostel = oneOf(body.hostel, 'Hostel', cfg.hostels as readonly string[]);
  }
  if (u.role === 'ADMIN' && body.name !== undefined) data.name = str(body.name, 'Name', { min: 2, max: 60 });
  if (body.upiId !== undefined) {
    const upi = str(body.upiId, 'UPI ID', { optional: true, max: 60 });
    if (upi && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upi)) throw bad('UPI ID looks like name@bank');
    data.upiId = upi || null;
  }
  if (body.buddyVisible !== undefined) {
    if (typeof body.buddyVisible !== 'boolean') throw bad('buddyVisible must be true/false');
    data.buddyVisible = body.buddyVisible;
  }
  const updated = await db.user.update({ where: { id: u.id }, data });
  return ok({ user: publicUser(updated) });
});
