import { db } from '../db';
import { forbidden, conflict } from '../api';
import { isDemoMode } from '../config';
import { loadGroup, placesMap, postSystem } from '../matching/engine';
import { lastPing, trackingForGroup } from '../tracking';
import { notify } from '../notify';
import type { User } from '@prisma/client';

/** Triggers an SOS: logs an EmergencyAlert with the best available location and informs the group + campus security. */
export async function triggerSos(user: User, groupId: string, coords?: { lat?: number; lng?: number }, note?: string) {
  const g = await loadGroup(groupId);
  const me = g.members.find((m) => m.userId === user.id && m.status === 'JOINED');
  if (!me) throw forbidden('Only riders in this trip can trigger SOS');
  if (['COMPLETED', 'CANCELLED'].includes(g.status)) throw conflict('This trip has ended');

  const places = await placesMap();
  const o = places.get(g.originId)!, d = places.get(g.destId)!;
  let lat: number, lng: number, approximate = false;
  if (Number.isFinite(coords?.lat) && Number.isFinite(coords?.lng) && Math.abs(coords!.lat as number) <= 90 && Math.abs(coords!.lng as number) <= 180) {
    lat = coords!.lat as number; lng = coords!.lng as number; // device GPS sent with the SOS
  } else {
    const ping = await lastPing(groupId);
    if (ping) { lat = ping.lat; lng = ping.lng; }
    else if (isDemoMode()) { const pos = (await trackingForGroup(g, o, d)).position ?? o; lat = pos.lat; lng = pos.lng; }
    else { lat = o.lat; lng = o.lng; approximate = true; } // no GPS available: pickup point, flagged as approximate
  }
  const active = await db.emergencyAlert.findFirst({ where: { userId: user.id, groupId, status: 'ACTIVE' } });
  const alert = active ?? await db.emergencyAlert.create({ data: { userId: user.id, groupId, lat, lng, approximate, note: note?.slice(0, 300) || null } });
  if (!active) {
    await postSystem(groupId, `🚨 SOS triggered by ${user.name.split(' ')[0]} — Campus Security has been alerted${approximate ? '' : ' with live location'}.`);
    const admins = await db.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await Promise.all(admins.map((a) => notify(a.id, 'SAFETY', '🚨 SOS emergency', `${user.name} triggered SOS on ${o.name} → ${d.name}.`, '/admin?tab=safety')));
  }
  return alert;
}
