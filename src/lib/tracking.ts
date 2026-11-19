// Live-trip position. Production: real GPS pings from riders' devices. Demo mode: simulated progress along a pseudo-route.
import type { Place } from '@prisma/client';
import { db } from './db';
import { isDemoMode } from './config';
import { avgSpeedKmh, buildRoute, etaMinutes, haversineKm, positionAt, roadKm, simulationSeconds, type LatLng } from './geo';

export const PING_FRESH_MS = 3 * 60_000;
export const ARRIVED_KM = 0.3;

export type Tracking = {
  source: 'GPS' | 'SIMULATED' | 'NONE';
  route: LatLng[];
  trail: LatLng[];
  position: LatLng | null;
  lastSeenAt: string | null;
  progress: number;
  km: number;
  etaMinutes: number;
  etaRemaining: number;
};

type G = { id: string; mode: string; status: string; startedAt: Date | null };

export async function trackingForGroup(g: G, origin: Place, dest: Place, now = new Date()): Promise<Tracking> {
  const km = roadKm(origin, dest);
  const eta = etaMinutes(g.mode, km);
  const straight = [origin, dest].map((p) => ({ lat: p.lat, lng: p.lng }));

  const pings = g.status === 'IN_PROGRESS'
    ? await db.locationPing.findMany({ where: { groupId: g.id, createdAt: { gt: new Date(now.getTime() - 30 * 60_000) } }, orderBy: { createdAt: 'desc' }, take: 40 })
    : [];
  const latest = pings[0];

  if (latest && now.getTime() - latest.createdAt.getTime() < PING_FRESH_MS) {
    const pos = { lat: latest.lat, lng: latest.lng };
    const total = Math.max(0.1, haversineKm(origin, dest));
    const remainingKm = haversineKm(pos, dest);
    const progress = Math.max(0, Math.min(1, 1 - remainingKm / total));
    return {
      source: 'GPS', route: straight, trail: pings.map((p) => ({ lat: p.lat, lng: p.lng })).reverse(), position: pos, lastSeenAt: latest.createdAt.toISOString(),
      progress, km, etaMinutes: eta, etaRemaining: Math.round(((remainingKm * 1.3) / avgSpeedKmh(g.mode, km)) * 60),
    };
  }

  if (isDemoMode()) {
    const route = buildRoute(origin, dest, g.id);
    const sim = simulationSeconds(eta);
    let progress = 0;
    if (g.status === 'COMPLETED') progress = 1;
    else if (g.status === 'IN_PROGRESS' && g.startedAt) progress = Math.min(1, Math.max(0, (now.getTime() - g.startedAt.getTime()) / 1000 / sim));
    return {
      source: 'SIMULATED', route, trail: [], position: positionAt(route, progress), lastSeenAt: null, progress, km, etaMinutes: eta,
      etaRemaining: g.status === 'IN_PROGRESS' || g.status === 'COMPLETED' ? Math.round(eta * (1 - progress)) : eta,
    };
  }

  return {
    source: 'NONE', route: straight, trail: [], position: g.status === 'COMPLETED' ? straight[1] : null, lastSeenAt: latest ? latest.createdAt.toISOString() : null,
    progress: g.status === 'COMPLETED' ? 1 : 0, km, etaMinutes: eta, etaRemaining: g.status === 'COMPLETED' ? 0 : eta,
  };
}

/** Most recent real ping for a group (used by SOS). */
export async function lastPing(groupId: string) {
  return db.locationPing.findFirst({ where: { groupId }, orderBy: { createdAt: 'desc' } });
}
