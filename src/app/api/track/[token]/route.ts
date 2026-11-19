// PUBLIC read-only live trip tracking (no login). Exposes only first names, plate/driver and progress.
import { db } from '@/lib/db';
import { handle, notFound, ok } from '@/lib/api';
import { placeDTO, trackingFor, firstName } from '@/lib/groups';

export const dynamic = 'force-dynamic';

export const GET = handle<{ token: string }>(async (_req, { params }) => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(params.token)) throw notFound('Tracking link is invalid or has expired');
  const g = await db.tripGroup.findUnique({
    where: { shareToken: params.token },
    include: { operator: true, members: { where: { status: 'JOINED' }, include: { user: true }, orderBy: { joinedAt: 'asc' } } },
  });
  if (!g || g.status === 'CANCELLED') throw notFound('Tracking link is invalid or has expired');
  const [o, d] = await Promise.all([db.place.findUnique({ where: { id: g.originId } }), db.place.findUnique({ where: { id: g.destId } })]);
  if (!o || !d) throw notFound('Route unavailable');
  const t = trackingFor(g, o, d);
  const label = g.status === 'COMPLETED' || t.progress >= 1 ? 'ARRIVED' : g.status === 'IN_PROGRESS' ? 'ON_THE_WAY' : 'NOT_STARTED';
  return ok({
    state: label, tripStatus: g.status, origin: placeDTO(o), dest: placeDTO(d), route: t.route, position: t.position, progress: t.progress,
    etaMinutes: t.etaMinutes, etaRemaining: t.etaRemaining, km: t.km, simulated: true,
    mode: g.mode, vehicleType: g.vehicleType, date: g.date, windowStart: g.windowStart, windowEnd: g.windowEnd, delayMins: g.delayMins,
    trainNumber: g.trainNumber, flightNumber: g.flightNumber, nightMode: g.nightMode, genderPref: g.genderPref,
    operator: g.operator ? { name: g.operator.name, plate: g.operator.plate, vehicleName: g.operator.vehicleName, badge: g.operator.badge } : null,
    riders: g.members.map((m) => ({ firstName: firstName(m.user.name), verified: m.user.idCardStatus === 'VERIFIED' && m.user.emailVerified, boarded: m.boarded })),
    updatedAt: new Date().toISOString(),
  });
});
