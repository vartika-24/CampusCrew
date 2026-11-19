import { db } from '@/lib/db';
import { ApiError, conflict, forbidden, handle, ok, readJson, str , readJsonOpt} from "@/lib/api";
import { requireUser } from '@/lib/auth';
import { activeMembers, createGroup, loadGroup, postSystem, type LegInput } from '@/lib/matching/engine';
import { outstandingDues } from '@/lib/safety/guards';
import { notify } from '@/lib/notify';
import { getSettings } from '@/lib/surge';
import { addDays } from '@/lib/time';
import { normalizeTransit } from '@/lib/transit';

export const dynamic = 'force-dynamic';

/** One-tap return sync: clones the crew, preferences and the reversed route for the semester-return date. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  const me = activeMembers(g).find((m) => m.userId === user.id);
  if (!me) throw forbidden('Only riders can sync a return trip');
  const body = await readJsonOpt(req);
  const settings = await getSettings();
  const date = str(body.date, 'Return date', { optional: true }) || settings.returnDate || addDays(g.date, 14);
  const windowStart = str(body.windowStart, 'Window start', { optional: true }) || g.windowStart;
  const windowEnd = str(body.windowEnd, 'Window end', { optional: true }) || g.windowEnd;
  let trainNumber = g.trainNumber;
  if (body.trainNumber) { const n = normalizeTransit(String(body.trainNumber)); if (n?.kind === 'TRAIN') trainNumber = n.number; }

  const dup = await db.tripGroup.findFirst({ where: { parentGroupId: g.id, date, status: { not: 'CANCELLED' } } });
  if (dup) throw conflict('A return crew for this date already exists for this trip', 'RETURN_EXISTS');

  const leg: LegInput = {
    originId: g.destId, destId: g.originId, date, windowStart, windowEnd, mode: g.mode as LegInput['mode'], vehicleType: g.vehicleType as LegInput['vehicleType'],
    luggage: me.luggage, genderPref: g.genderPref as LegInput['genderPref'], trainNumber: g.mode === 'TRAIN' ? trainNumber : null, flightNumber: g.mode === 'FLIGHT' ? g.flightNumber : null,
  };
  const journey = await db.journey.create({ data: { ownerId: user.id, title: 'Return trip (synced)' } });
  const seg = await db.tripSegment.create({ data: { journeyId: journey.id, userId: user.id, seq: 1, ...leg, status: 'PLANNED' } });
  const ng = await createGroup(user, leg, { segmentId: seg.id, parentGroupId: g.id, groupNote: 'Return sync' });

  // Clone the crew: everyone else is added (or skipped with a reason).
  const added: string[] = [], skipped: { name: string; reason: string }[] = [];
  for (const m of activeMembers(g).filter((x) => x.userId !== user.id)) {
    try {
      if ((await outstandingDues(m.userId)).length) throw new ApiError(403, 'unsettled dues');
      const j = await db.journey.create({ data: { ownerId: m.userId, title: 'Return trip (synced)' } });
      const s = await db.tripSegment.create({ data: { journeyId: j.id, userId: m.userId, seq: 1, ...leg, luggage: m.luggage, status: 'MATCHED', groupId: ng.id } });
      await db.groupMember.create({ data: { groupId: ng.id, userId: m.userId, segmentId: s.id, luggage: m.luggage, status: 'JOINED' } });
      await notify(m.userId, 'INVITE', 'Return crew synced', `${user.name.split(' ')[0]} synced your return trip for ${date}. Leave it any time before departure.`, `/trips/${ng.id}`);
      added.push(m.user.name.split(' ')[0]);
    } catch (e) {
      skipped.push({ name: m.user.name.split(' ')[0], reason: e instanceof ApiError ? e.message : 'could not be added' });
    }
  }
  await postSystem(ng.id, `Return crew synced from ${g.date}: ${[user.name.split(' ')[0], ...added].join(', ')} are on board.`);
  await postSystem(g.id, `${user.name.split(' ')[0]} synced the return trip for ${date}.`);
  return ok({ groupId: ng.id, added, skipped }, { status: 201 });
});
