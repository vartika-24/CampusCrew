import type { Journey, TripSegment } from '@prisma/client';
import { db } from './db';
import { placeDTO } from './groups';
import { placesMap } from './matching/engine';

export async function serializeJourneys(journeys: (Journey & { segments: TripSegment[] })[]) {
  const places = await placesMap();
  const groupIds = [...new Set(journeys.flatMap((j) => j.segments.map((s) => s.groupId).filter(Boolean) as string[]))];
  const groups = await db.tripGroup.findMany({ where: { id: { in: groupIds } }, include: { members: { where: { status: 'JOINED' }, select: { id: true } } } });
  return journeys.map((j) => ({
    id: j.id, title: j.title, createdAt: j.createdAt.toISOString(),
    segments: [...j.segments].sort((a, b) => a.seq - b.seq).map((s) => {
      const g = groups.find((x) => x.id === s.groupId);
      return {
        id: s.id, seq: s.seq, origin: placeDTO(places.get(s.originId)), dest: placeDTO(places.get(s.destId)), date: s.date,
        windowStart: s.windowStart, windowEnd: s.windowEnd, mode: s.mode, vehicleType: s.vehicleType, luggage: s.luggage,
        genderPref: s.genderPref, trainNumber: s.trainNumber, flightNumber: s.flightNumber, status: s.status, groupId: s.groupId,
        group: g ? { id: g.id, status: g.status, riders: g.members.length, seats: g.seats, delayMins: g.delayMins, windowStart: g.windowStart, windowEnd: g.windowEnd } : null,
      };
    }),
  }));
}
