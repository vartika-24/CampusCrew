import { db } from '@/lib/db';
import { bad, conflict, handle, oneOf, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { GENDER_PREFS } from '@/lib/constants';
import { createGroup, normalizeLeg, type LegInput } from '@/lib/matching/engine';
import { genderAllowed } from '@/lib/safety/gender';
import { fromMinutes, TIME_RE, toMinutes } from '@/lib/time';
import { findTransit, normalizeTransit } from '@/lib/transit';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** "Coordinate Cab to Station/Airport Together": spins up a linked Leg-1 cab crew and nudges opted-in buddies. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const t = normalizeTransit(str(body.number, 'Train / flight number'));
  const date = str(body.date, 'Date');
  if (!t) throw bad('Enter a valid train or flight number');
  const info = findTransit(t.number);
  const departs = str(body.departs, 'Departure time', { optional: true }) || info?.departs;
  if (!departs || !TIME_RE.test(departs)) throw bad('Enter the departure time (HH:MM) for this train/flight');

  const stationCode = info?.stationCode ?? (t.kind === 'FLIGHT' ? 'IXD' : 'PRYJ');
  const stationRow = await db.place.findUnique({ where: { code: stationCode } });
  const origin = await db.place.findUnique({ where: { code: typeof body.originCode === 'string' ? body.originCode : 'IIITA-G1' } });
  if (!stationRow || !origin || origin.kind !== 'CAMPUS') throw bad('Pick a campus pickup point');

  const pref = body.genderPref ? oneOf(body.genderPref, 'Gender preference', GENDER_PREFS) : 'MIXED';
  const lead = t.kind === 'FLIGHT' ? [270, 210] : [240, 150]; // cab window = departure minus 4h..2.5h (train) / 4.5h..3.5h (flight)
  const dep = toMinutes(departs);
  const leg1: LegInput = normalizeLeg({
    originId: origin.id, destId: stationRow.id, date, windowStart: fromMinutes(Math.max(0, dep - lead[0])), windowEnd: fromMinutes(Math.max(1, dep - lead[1])),
    mode: 'CAB', vehicleType: body.vehicleType === 'SUV6' ? 'SUV6' : 'SEDAN4', luggage: Math.min(3, Math.max(0, Number(body.luggage ?? 1) || 0)), genderPref: pref,
    trainNumber: t.kind === 'TRAIN' ? t.number : null, flightNumber: t.kind === 'FLIGHT' ? t.number : null,
  });
  if (!genderAllowed(user.gender, pref)) throw bad('That gender preference is not available for your profile');
  if (toMinutes(leg1.windowEnd) <= toMinutes(leg1.windowStart)) throw conflict('Departure is too early to plan a cab same-day');

  const journey = await db.journey.create({ data: { ownerId: user.id, title: `${t.kind === 'FLIGHT' ? 'Flight' : 'Train'} ${t.number} — campus cab + ${t.kind === 'FLIGHT' ? 'flight' : 'train'}` } });
  const s1 = await db.tripSegment.create({ data: { ...leg1, journeyId: journey.id, userId: user.id, seq: 1, status: 'PLANNED' } });
  const group = await createGroup(user, leg1, { segmentId: s1.id, groupNote: `Linked to ${t.kind === 'FLIGHT' ? 'flight' : 'train'} ${t.number}` });
  const dest2 = info?.toCode ? await db.place.findUnique({ where: { code: info.toCode } }) : null;
  if (dest2) {
    // Leg 2 (the train itself) is stored as a linked, independently matchable segment.
    await db.tripSegment.create({
      data: {
        journeyId: journey.id, userId: user.id, seq: 2, originId: stationRow.id, destId: dest2.id, date, windowStart: fromMinutes(Math.max(0, dep - 10)), windowEnd: fromMinutes(Math.min(1439, dep + 10)),
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
      if (!genderAllowed(e.user.gender, pref)) continue;
      await notify(e.userId, 'INVITE', `Share a cab for ${t.kind === 'FLIGHT' ? 'flight' : 'train'} ${t.number}?`, `${user.name.split(' ')[0]} is organising a cab ${origin.name.split(' (')[0]} → ${stationRow.name.split(' (')[0]} (${leg1.windowStart}–${leg1.windowEnd}).`, `/trips/${group.id}`);
      invited++;
    }
  }
  return ok({ groupId: group.id, journeyId: journey.id, invited, window: `${leg1.windowStart}–${leg1.windowEnd}` }, { status: 201 });
});
