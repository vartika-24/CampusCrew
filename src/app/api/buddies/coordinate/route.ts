import { db } from '@/lib/db';
import { bad, conflict, handle, oneOf, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { GENDER_PREFS } from '@/lib/constants';
import { createGroup, normalizeLeg, type LegInput } from '@/lib/matching/engine';
import { effectiveGender, genderAllowed } from '@/lib/safety/gender';
import { assertVerified } from '@/lib/safety/guards';
import { fromMinutes, TIME_RE, toMinutes } from '@/lib/time';
import { normalizeTransit } from '@/lib/transit';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/**
 * "Coordinate Cab to Station/Airport Together": spins up a linked Leg-1 cab crew from a campus pickup point to the
 * station/airport the student chooses, timed from the departure time THEY enter, and nudges opted-in buddies.
 */
export const POST = handle(async (req) => {
  const user = await requireUser();
  assertVerified(user);
  const body = await readJson(req);
  const t = normalizeTransit(str(body.number, 'Train / flight number'));
  const date = str(body.date, 'Date');
  if (!t) throw bad('Enter a valid train or flight number');
  const departs = str(body.departs, 'Departure time');
  if (!TIME_RE.test(departs)) throw bad('Enter the departure time as HH:MM (check it on your ticket)');

  const station = await db.place.findFirst({ where: { id: str(body.stationId, 'Station / airport'), isPublic: true, kind: { in: ['STATION', 'AIRPORT', 'BUS'] } } });
  const origin = await db.place.findFirst({ where: { id: str(body.originId, 'Campus pickup point'), isPublic: true, kind: 'CAMPUS' } });
  if (!station || !origin) throw bad('Pick a campus pickup point and the station / airport');
  const dest2 = typeof body.destId === 'string' && body.destId ? await db.place.findFirst({ where: { id: body.destId, isPublic: true } }) : null;

  const pref = body.genderPref ? oneOf(body.genderPref, 'Gender preference', GENDER_PREFS) : 'MIXED';
  if (!genderAllowed(effectiveGender(user), pref)) throw bad('That gender preference is not available for your profile');
  const lead = t.kind === 'FLIGHT' ? [270, 210] : [240, 150]; // cab window = departure minus 4h..2.5h (train) / 4.5h..3.5h (flight)
  const dep = toMinutes(departs);
  const leg1: LegInput = normalizeLeg({
    originId: origin.id, destId: station.id, date, windowStart: fromMinutes(Math.max(0, dep - lead[0])), windowEnd: fromMinutes(Math.max(1, dep - lead[1])),
    mode: 'CAB', vehicleType: body.vehicleType === 'SUV6' ? 'SUV6' : 'SEDAN4', luggage: Math.min(3, Math.max(0, Number(body.luggage ?? 1) || 0)), genderPref: pref,
    trainNumber: t.kind === 'TRAIN' ? t.number : null, flightNumber: t.kind === 'FLIGHT' ? t.number : null,
  });
  if (toMinutes(leg1.windowEnd) <= toMinutes(leg1.windowStart)) throw conflict('Departure is too early to plan a same-day cab');

  const journey = await db.journey.create({ data: { ownerId: user.id, title: `${t.kind === 'FLIGHT' ? 'Flight' : 'Train'} ${t.number} — campus cab + ${t.kind === 'FLIGHT' ? 'flight' : 'train'}` } });
  const s1 = await db.tripSegment.create({ data: { ...leg1, journeyId: journey.id, userId: user.id, seq: 1, status: 'PLANNED' } });
  const group = await createGroup(user, leg1, { segmentId: s1.id, groupNote: `Linked to ${t.kind === 'FLIGHT' ? 'flight' : 'train'} ${t.number}` });
  if (dest2 && dest2.id !== station.id) {
    await db.tripSegment.create({
      data: {
        journeyId: journey.id, userId: user.id, seq: 2, originId: station.id, destId: dest2.id, date, windowStart: fromMinutes(Math.max(0, dep - 10)), windowEnd: fromMinutes(Math.min(1439, dep + 10)),
        mode: t.kind, vehicleType: 'SHARED', luggage: 0, genderPref: pref, trainNumber: t.kind === 'TRAIN' ? t.number : null, flightNumber: t.kind === 'FLIGHT' ? t.number : null, status: 'PLANNED',
      },
    });
  }

  // Invite opted-in buddies (same college, verified); gender-restricted crews only notify eligible people.
  let invited = 0;
  if (user.buddyVisible) {
    const domain = user.email.split('@')[1];
    const entries = await db.buddyEntry.findMany({
      where: { number: t.number, date, userId: { not: user.id }, user: { buddyVisible: true, suspended: false, idCardStatus: 'VERIFIED', email: { endsWith: `@${domain}` } } },
      include: { user: true },
    });
    for (const e of entries) {
      if (!genderAllowed(effectiveGender(e.user), pref)) continue;
      await notify(e.userId, 'INVITE', `Share a cab for ${t.kind === 'FLIGHT' ? 'flight' : 'train'} ${t.number}?`, `${user.name.split(' ')[0]} is organising a cab ${origin.name.split(' (')[0]} → ${station.name.split(' (')[0]} (${leg1.windowStart}–${leg1.windowEnd}).`, `/trips/${group.id}`);
      invited++;
    }
  }
  return ok({ groupId: group.id, journeyId: journey.id, invited, window: `${leg1.windowStart}–${leg1.windowEnd}` }, { status: 201 });
});
