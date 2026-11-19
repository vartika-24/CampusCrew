import { db } from '../db';
import { forbidden, conflict } from '../api';
import { trackingFor } from '../groups';
import { loadGroup, placesMap, postSystem } from '../matching/engine';
import { notify } from '../notify';
import type { User } from '@prisma/client';

/** Triggers an SOS: logs an EmergencyAlert with (simulated) GPS, informs the group + campus security. */
export async function triggerSos(user: User, groupId: string, coords?: { lat?: number; lng?: number }, note?: string) {
  const g = await loadGroup(groupId);
  const me = g.members.find((m) => m.userId === user.id && m.status === 'JOINED');
  if (!me) throw forbidden('Only riders in this trip can trigger SOS');
  if (['COMPLETED', 'CANCELLED'].includes(g.status)) throw conflict('This trip has ended');

  const places = await placesMap();
  const o = places.get(g.originId)!, d = places.get(g.destId)!;
  let lat: number, lng: number;
  if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng)) {
    lat = coords!.lat as number; lng = coords!.lng as number;
  } else {
    const pos = trackingFor(g, o, d).position; // simulated GPS along the route
    lat = pos.lat; lng = pos.lng;
  }
  const active = await db.emergencyAlert.findFirst({ where: { userId: user.id, groupId, status: 'ACTIVE' } });
  const alert = active ?? await db.emergencyAlert.create({ data: { userId: user.id, groupId, lat, lng, note: note?.slice(0, 300) || null } });
  if (!active) {
    await postSystem(groupId, `🚨 SOS triggered by ${user.name.split(' ')[0]} — Campus Security has been alerted with live location.`);
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, 'SAFETY', '🚨 SOS emergency', `${user.name} triggered SOS on ${o.name} → ${d.name}.`, '/admin?tab=safety')));
  }
  return alert;
}
