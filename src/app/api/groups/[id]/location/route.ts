import { db } from '@/lib/db';
import { bad, conflict, forbidden, handle, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** A rider's device reports its GPS position while the trip is live. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: params.id, userId: user.id } }, include: { group: true } });
  if (!m || m.status !== 'JOINED') throw forbidden('Only riders can share location for this trip');
  if (m.group.status !== 'IN_PROGRESS') throw conflict('Location sharing is only available while the ride is in progress', 'NOT_LIVE');
  const body = await readJson(req);
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) throw bad('Invalid coordinates');
  const accuracy = Number.isFinite(Number(body.accuracy)) ? Math.min(Number(body.accuracy), 100000) : null;
  const prev = await db.locationPing.findFirst({ where: { groupId: params.id, userId: user.id }, orderBy: { createdAt: 'desc' } });
  if (prev && Date.now() - prev.createdAt.getTime() < 4000) return ok({ stored: false }); // throttle
  await db.locationPing.create({ data: { groupId: params.id, userId: user.id, lat, lng, accuracy } });
  return ok({ stored: true });
});
