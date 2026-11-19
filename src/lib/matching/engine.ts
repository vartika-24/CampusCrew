// DB-facing matching engine: candidate search, join/host, waitlist promotion, cancellation reshuffle.
import { randomBytes, randomInt } from 'crypto';
import type { Prisma, TripGroup, GroupMember, User, TripSegment, Place } from '@prisma/client';
import { db } from '../db';
import { ApiError, bad, conflict, forbidden, notFound } from '../api';
import {
  LATE_CANCEL_HOURS, MAX_LUGGAGE, VEHICLE_SPECS, type GenderPref, type Mode, type VehicleType,
} from '../constants';
import { effectiveGender, genderAllowed, genderWhere } from '../safety/gender';
import { assertNightAllowed, assertNoDues, assertVerified, recomputeTrust } from '../safety/guards';
import { hoursUntil, overlapMinutes, TIME_RE, DATE_RE, toMinutes, todayIST, fromMinutes } from '../time';
import { notify } from '../notify';
import { splitFare } from '../fare';
import { FLIGHT_RE, TRAIN_RE } from '../transit';
import { isNightWindow, scoreMatch, type GroupLite, type ScoreResult } from './scoring';

export type GroupWithMembers = TripGroup & { members: (GroupMember & { user: User })[] };

export const touchGroup = (id: string) => db.tripGroup.update({ where: { id }, data: { updatedAt: new Date() } });

export async function postSystem(groupId: string, body: string) {
  await db.message.create({ data: { groupId, kind: 'SYSTEM', body } });
  await touchGroup(groupId);
}

export const activeMembers = (g: GroupWithMembers) => g.members.filter((m) => m.status === 'JOINED');
export const waitlisted = (g: GroupWithMembers) => g.members.filter((m) => m.status === 'WAITLIST');

export function toLite(g: GroupWithMembers): GroupLite {
  return {
    window: { start: g.windowStart, end: g.windowEnd },
    seats: g.seats,
    bagCapacity: g.bagCapacity,
    nightMode: g.nightMode,
    members: activeMembers(g).map((m) => ({
      trustScore: m.user.trustScore, hostel: m.user.hostel, completedRides: m.user.completedRides,
      punctualCount: m.user.punctualCount, luggage: m.luggage,
    })),
  };
}

export async function loadGroup(id: string): Promise<GroupWithMembers> {
  const g = await db.tripGroup.findUnique({ where: { id }, include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } } });
  if (!g) throw notFound('Trip not found');
  return g;
}

/** Loads a group the viewer is allowed to see; gender-mismatched viewers get a plain 404 (no leak). */
export async function loadVisibleGroup(id: string, viewer: User): Promise<GroupWithMembers> {
  const g = await loadGroup(id);
  const isMember = g.members.some((m) => m.userId === viewer.id && m.status !== 'LEFT');
  if (!isMember && viewer.role !== 'ADMIN' && !genderAllowed(effectiveGender(viewer), g.genderPref)) throw notFound('Trip not found');
  return g;
}

export async function placesMap(): Promise<Map<string, Place>> {
  const all = await db.place.findMany();
  return new Map(all.map((p) => [p.id, p]));
}

// ---------- Validation ----------
export type LegInput = {
  originId: string; destId: string; date: string; windowStart: string; windowEnd: string;
  mode: Mode; vehicleType: VehicleType; luggage: number; genderPref: GenderPref;
  trainNumber?: string | null; flightNumber?: string | null;
};

export function specFor(mode: Mode, vehicleType: VehicleType) {
  if (mode === 'CAB') return VEHICLE_SPECS[vehicleType === 'SUV6' ? 'SUV6' : 'SEDAN4'];
  if (mode === 'AUTO') return VEHICLE_SPECS.AUTO;
  return VEHICLE_SPECS.SHARED;
}

export function normalizeLeg(leg: LegInput): LegInput {
  const vehicleType: VehicleType = leg.mode === 'CAB' ? (leg.vehicleType === 'SUV6' ? 'SUV6' : 'SEDAN4') : leg.mode === 'AUTO' ? 'AUTO' : 'SHARED';
  return { ...leg, vehicleType };
}

export async function validateLeg(user: User, leg: LegInput) {
  if (leg.originId === leg.destId) throw bad('Origin and destination must differ');
  const places = await db.place.findMany({ where: { id: { in: [leg.originId, leg.destId] }, isPublic: true } });
  if (places.length !== 2) throw bad('Pick verified public pickup points / hubs only');
  if (!DATE_RE.test(leg.date)) throw bad('Invalid date');
  if (leg.date < todayIST()) throw bad('Travel date cannot be in the past');
  if (!TIME_RE.test(leg.windowStart) || !TIME_RE.test(leg.windowEnd)) throw bad('Invalid time window');
  if (toMinutes(leg.windowEnd) <= toMinutes(leg.windowStart)) throw bad('Window end must be after window start');
  if (leg.luggage < 0 || leg.luggage > MAX_LUGGAGE) throw bad(`Luggage must be 0–${MAX_LUGGAGE} bags`);
  const spec = specFor(leg.mode, leg.vehicleType);
  if (leg.luggage > spec.bags) throw bad(`${spec.label} cannot carry ${leg.luggage} bags`);
  if (!genderAllowed(effectiveGender(user), leg.genderPref)) {
    throw forbidden(leg.genderPref === 'GIRLS_ONLY' ? 'Girls-only trips are available to female students only' : 'Boys-only trips are available to male students only', 'GENDER_LOCK');
  }
  if (leg.mode === 'TRAIN' && !(leg.trainNumber && TRAIN_RE.test(leg.trainNumber))) throw bad('Enter a valid 5-digit train number');
  if (leg.mode === 'FLIGHT' && !(leg.flightNumber && FLIGHT_RE.test(leg.flightNumber))) throw bad('Enter a valid flight number, e.g. 6E-2134');
  assertNightAllowed(user, { start: leg.windowStart, end: leg.windowEnd });
}

/** A user cannot be in two overlapping crews on the same date. */
export async function assertNoClash(userId: string, date: string, start: string, end: string, ignoreGroupId?: string) {
  const mine = await db.groupMember.findMany({
    where: { userId, status: { in: ['JOINED', 'WAITLIST'] }, group: { date, status: { in: ['OPEN', 'CONFIRMED', 'IN_PROGRESS'] }, ...(ignoreGroupId ? { id: { not: ignoreGroupId } } : {}) } },
    include: { group: true },
  });
  for (const m of mine) {
    if (overlapMinutes(m.group.windowStart, m.group.windowEnd, start, end) > 0) {
      throw conflict('You already have a crew in this time window. Leave it first or pick another slot.', 'TIME_CLASH');
    }
  }
}

// ---------- Candidate search ----------
export type Candidate = {
  group: GroupWithMembers;
  score: ScoreResult;
};

export async function candidateGroups(user: User, seg: Pick<TripSegment, 'originId' | 'destId' | 'date' | 'windowStart' | 'windowEnd' | 'mode' | 'vehicleType' | 'luggage' | 'genderPref' | 'trainNumber' | 'flightNumber'>): Promise<Candidate[]> {
  const where: Prisma.TripGroupWhereInput = {
    originId: seg.originId, destId: seg.destId, date: seg.date, mode: seg.mode,
    status: { in: ['OPEN', 'CONFIRMED'] },
    creatorId: { not: user.id },
    members: { none: { userId: user.id, status: { in: ['JOINED', 'WAITLIST'] } } },
    ...genderWhere(effectiveGender(user)), // HARD FILTER: never leaks gendered trips
  };
  if (seg.mode === 'CAB') where.vehicleType = seg.vehicleType;
  if (seg.mode === 'TRAIN' && seg.trainNumber) where.trainNumber = seg.trainNumber;
  if (seg.mode === 'FLIGHT' && seg.flightNumber) where.flightNumber = seg.flightNumber;
  if (seg.genderPref !== 'MIXED') where.genderPref = seg.genderPref;

  const groups = await db.tripGroup.findMany({ where, include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } } });
  return groups
    .map((group) => ({
      group,
      score: scoreMatch(toLite(group), {
        window: { start: seg.windowStart, end: seg.windowEnd }, trustScore: user.trustScore, hostel: user.hostel,
        luggage: seg.luggage, completedRides: user.completedRides, punctualCount: user.punctualCount,
      }),
    }))
    .filter((c) => c.score.parts.time > 0) // no overlap at all -> not a candidate
    .sort((a, b) => Number(b.score.eligible) - Number(a.score.eligible) || b.score.total - a.score.total);
}

// ---------- Group creation / joining ----------
async function pickOperator(vehicleType: string, mode: string) {
  if (mode !== 'CAB' && mode !== 'AUTO') return null;
  const ops = await db.operator.findMany({ where: { vehicleType, active: true }, include: { groups: { where: { status: { in: ['OPEN', 'CONFIRMED', 'IN_PROGRESS'] } }, select: { id: true } } } });
  if (!ops.length) return null;
  ops.sort((a, b) => a.groups.length - b.groups.length);
  return ops[0];
}

export const newPin = () => String(randomInt(0, 10000)).padStart(4, '0');
export const newToken = () => randomBytes(18).toString('base64url');

export async function createGroup(host: User, leg: LegInput, opts: { segmentId?: string; parentGroupId?: string; note?: string; groupNote?: string } = {}) {
  const l = normalizeLeg(leg);
  assertVerified(host);
  await validateLeg(host, l);
  await assertNoDues(host.id);
  await assertNoClash(host.id, l.date, l.windowStart, l.windowEnd);
  const spec = specFor(l.mode, l.vehicleType);
  const operator = await pickOperator(l.vehicleType, l.mode);
  const group = await db.tripGroup.create({
    data: {
      creatorId: host.id, originId: l.originId, destId: l.destId, date: l.date, windowStart: l.windowStart, windowEnd: l.windowEnd,
      mode: l.mode, vehicleType: l.vehicleType, seats: spec.seats, bagCapacity: spec.bags, genderPref: l.genderPref,
      nightMode: isNightWindow({ start: l.windowStart, end: l.windowEnd }),
      pin: newPin(), shareToken: newToken(), operatorId: operator?.id ?? null,
      trainNumber: l.trainNumber ?? null, flightNumber: l.flightNumber ?? null,
      parentGroupId: opts.parentGroupId ?? null, note: opts.groupNote ?? null,
    },
  });
  await db.groupMember.create({
    data: { groupId: group.id, userId: host.id, segmentId: opts.segmentId ?? null, luggage: l.luggage, status: 'JOINED', paymentStatus: 'PAID' },
  });
  if (opts.segmentId) await db.tripSegment.update({ where: { id: opts.segmentId }, data: { groupId: group.id, status: 'MATCHED' } });
  await postSystem(group.id, `${host.name.split(' ')[0]} started this crew${group.nightMode ? ' — Night Safety Mode Active 🌙' : ''}.`);
  return group;
}

/** Joins (or waitlists) `user` into `groupId`. Creates a single-leg segment if none supplied. */
export async function joinGroup(user: User, groupId: string, opts: { segmentId?: string; luggage?: number } = {}) {
  const g = await loadVisibleGroup(groupId, user);
  if (!['OPEN', 'CONFIRMED'].includes(g.status)) throw conflict('This trip is no longer accepting riders');
  if (!genderAllowed(effectiveGender(user), g.genderPref)) throw notFound('Trip not found');
  assertVerified(user);
  await assertNoDues(user.id);
  assertNightAllowed(user, { start: g.windowStart, end: g.windowEnd });

  let luggage = opts.luggage ?? 0;
  let segment: TripSegment | null = null;
  if (opts.segmentId) {
    segment = await db.tripSegment.findUnique({ where: { id: opts.segmentId } });
    if (!segment || segment.userId !== user.id) throw notFound('Leg not found');
    if (segment.status === 'MATCHED') throw conflict('This leg is already matched');
    luggage = segment.luggage;
  }
  if (!Number.isInteger(luggage) || luggage < 0 || luggage > MAX_LUGGAGE) throw bad(`Luggage must be 0–${MAX_LUGGAGE} bags`);

  const existing = g.members.find((m) => m.userId === user.id);
  if (existing && existing.status !== 'LEFT') throw conflict('You are already part of this trip');
  await assertNoClash(user.id, g.date, g.windowStart, g.windowEnd, g.id);

  if (!segment) {
    const journey = await db.journey.create({ data: { ownerId: user.id, title: 'Joined crew' } });
    segment = await db.tripSegment.create({
      data: {
        journeyId: journey.id, userId: user.id, seq: 1, originId: g.originId, destId: g.destId, date: g.date,
        windowStart: g.windowStart, windowEnd: g.windowEnd, mode: g.mode, vehicleType: g.vehicleType, luggage,
        genderPref: g.genderPref, trainNumber: g.trainNumber, flightNumber: g.flightNumber,
      },
    });
  }

  const lite = toLite(g);
  const fits = scoreMatch(lite, {
    window: { start: g.windowStart, end: g.windowEnd }, trustScore: user.trustScore, hostel: user.hostel, luggage,
    completedRides: user.completedRides, punctualCount: user.punctualCount,
  });
  const capacityBlocked = fits.blockers.some((b) => b === 'No seats left' || b === 'Not enough luggage space');
  const status = capacityBlocked ? 'WAITLIST' : 'JOINED';

  const data = { status, luggage, segmentId: segment.id, boarded: false, boardedAt: null, leftAt: null, paymentStatus: 'UNPAID', shareAmount: 0, joinedAt: new Date() };
  await db.groupMember.upsert({ where: { groupId_userId: { groupId: g.id, userId: user.id } }, create: { groupId: g.id, userId: user.id, ...data }, update: data });
  await db.tripSegment.update({ where: { id: segment.id }, data: { groupId: g.id, status: status === 'JOINED' ? 'MATCHED' : 'WAITLISTED' } });

  const first = user.name.split(' ')[0];
  if (status === 'JOINED') {
    await postSystem(g.id, `${first} joined the ${g.mode === 'CAB' ? 'cab' : g.mode.toLowerCase()}`);
    await recalcFare(g.id);
    if (g.creatorId !== user.id) await notify(g.creatorId, 'INFO', 'New rider joined', `${first} joined your crew.`, `/trips/${g.id}`);
  } else {
    await postSystem(g.id, `${first} joined the waitlist`);
  }
  return { status, groupId: g.id, segmentId: segment.id };
}

/** Auto-match: join the best eligible crew (score >= threshold) or host a new one. */
export async function matchOrHost(user: User, segmentId: string, threshold = 45) {
  const seg = await db.tripSegment.findUnique({ where: { id: segmentId } });
  if (!seg || seg.userId !== user.id) throw notFound('Leg not found');
  const candidates = await candidateGroups(user, seg);
  const best = candidates.find((c) => c.score.eligible && c.score.total >= threshold);
  if (best) {
    try {
      const r = await joinGroup(user, best.group.id, { segmentId });
      return { action: 'JOINED' as const, ...r, score: best.score.total };
    } catch (e) {
      if (!(e instanceof ApiError) || e.status >= 500) throw e;
      if (e.code === 'DUES_PENDING' || e.code === 'NIGHT_RESTRICTED' || e.code === 'TIME_CLASH') throw e;
    }
  }
  const group = await createGroup(user, seg as unknown as LegInput, { segmentId });
  return { action: 'HOSTED' as const, groupId: group.id, status: 'JOINED', segmentId };
}

// ---------- Fare / waitlist / cancellation ----------
export async function recalcFare(groupId: string) {
  const g = await loadGroup(groupId);
  if (g.fareTotal == null) return null;
  const counted = g.status === 'COMPLETED'
    ? activeMembers(g).filter((m) => m.boarded)
    : activeMembers(g);
  const riders = counted.length || 1;
  const split = splitFare(g.fareTotal, riders, g.feePerRider);
  for (const m of g.members) {
    const isCounted = counted.some((c) => c.id === m.id);
    await db.groupMember.update({
      where: { id: m.id },
      data: { shareAmount: isCounted ? split.perRider : 0, ...(m.userId === g.creatorId ? { paymentStatus: 'PAID' } : {}) },
    });
  }
  await touchGroup(groupId);
  return split;
}

export async function promoteWaitlist(groupId: string): Promise<GroupMember | null> {
  const g = await loadGroup(groupId);
  if (!['OPEN', 'CONFIRMED'].includes(g.status)) return null;
  const queue = waitlisted(g);
  if (!queue.length) return null;
  const segs = await db.tripSegment.findMany({ where: { id: { in: queue.map((q) => q.segmentId).filter(Boolean) as string[] } } });
  const lite = toLite(g);
  const ranked = queue
    .map((q) => {
      const seg = segs.find((s) => s.id === q.segmentId);
      const score = scoreMatch(lite, {
        window: seg ? { start: seg.windowStart, end: seg.windowEnd } : lite.window,
        trustScore: q.user.trustScore, hostel: q.user.hostel, luggage: q.luggage,
        completedRides: q.user.completedRides, punctualCount: q.user.punctualCount,
      });
      return { q, score };
    })
    .filter((r) => r.score.eligible)
    .sort((a, b) => b.score.total - a.score.total || a.q.joinedAt.getTime() - b.q.joinedAt.getTime());
  const top = ranked[0];
  if (!top) return null;
  const promoted = await db.groupMember.update({ where: { id: top.q.id }, data: { status: 'JOINED', joinedAt: new Date() } });
  if (top.q.segmentId) await db.tripSegment.update({ where: { id: top.q.segmentId }, data: { status: 'MATCHED' } });
  const first = top.q.user.name.split(' ')[0];
  await postSystem(groupId, `${first} was promoted from the waitlist and joined the crew 🎉`);
  await notify(top.q.userId, 'PROMOTION', 'You got a seat!', `A seat opened up and you were promoted from the waitlist.`, `/trips/${groupId}`);
  await recalcFare(groupId);
  return promoted;
}

export type LeaveResult = { penalty: 'NONE' | 'REGULAR' | 'LATE'; waived: boolean; groupCancelled: boolean; newHostId?: string };

export async function leaveGroup(user: User, groupId: string, opts: { waivePenalty?: boolean } = {}): Promise<LeaveResult> {
  const g = await loadGroup(groupId);
  const me = g.members.find((m) => m.userId === user.id && m.status !== 'LEFT');
  if (!me) throw notFound('You are not part of this trip');
  if (['IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(g.status)) throw conflict('This trip can no longer be left');

  const wasJoined = me.status === 'JOINED';
  const delayed = g.delayMins > 0;
  const hrs = hoursUntil(g.date, g.windowStart);
  let penalty: LeaveResult['penalty'] = 'NONE';
  if (!opts.waivePenalty && wasJoined && !delayed && g.members.some((m) => m.userId !== user.id && m.status === 'JOINED')) {
    // Only penalise when other riders are affected.
    if (hrs < LATE_CANCEL_HOURS) penalty = 'LATE';
    else if (g.status === 'CONFIRMED') penalty = 'REGULAR';
  }

  await db.groupMember.update({ where: { id: me.id }, data: { status: 'LEFT', leftAt: new Date(), boarded: false, shareAmount: 0 } });
  if (me.segmentId) await db.tripSegment.update({ where: { id: me.segmentId }, data: { groupId: null, status: delayed ? 'PLANNED' : 'CANCELLED' } });

  if (penalty !== 'NONE') {
    await db.user.update({
      where: { id: user.id },
      data: { cancelCount: { increment: 1 }, ...(penalty === 'LATE' ? { lateCancels: { increment: 1 } } : {}) },
    });
    await recomputeTrust(user.id);
    await notify(user.id, 'PENALTY', penalty === 'LATE' ? 'Late cancellation penalty' : 'Cancellation recorded', penalty === 'LATE' ? 'Cancelling within 3 hours of departure costs 15 trust points.' : 'Cancelling a confirmed crew costs 5 trust points.', `/profile`);
  }

  const first = user.name.split(' ')[0];
  const remaining = g.members.filter((m) => m.userId !== user.id && m.status === 'JOINED');
  let groupCancelled = false;
  let newHostId: string | undefined;

  if (wasJoined) {
    await postSystem(groupId, delayed ? `${first} left the crew (penalty-free: trip delayed)` : `${first} left the crew${penalty === 'LATE' ? ' at the last minute' : ''}`);
    if (g.creatorId === user.id) {
      if (remaining.length === 0) {
        await db.tripGroup.update({ where: { id: groupId }, data: { status: 'CANCELLED' } });
        for (const w of g.members.filter((m) => m.status === 'WAITLIST')) {
          if (w.segmentId) await db.tripSegment.update({ where: { id: w.segmentId }, data: { groupId: null, status: 'PLANNED' } });
          await db.groupMember.update({ where: { id: w.id }, data: { status: 'LEFT', leftAt: new Date() } });
          await notify(w.userId, 'INFO', 'Crew cancelled', 'The host cancelled and nobody else was onboard. Find another crew.', '/trips');
        }
        groupCancelled = true;
      } else {
        const next = [...remaining].sort((a, b) => b.user.trustScore - a.user.trustScore || a.joinedAt.getTime() - b.joinedAt.getTime())[0];
        await db.tripGroup.update({ where: { id: groupId }, data: { creatorId: next.userId } });
        await db.groupMember.update({ where: { id: next.id }, data: { paymentStatus: 'PAID' } });
        newHostId = next.userId;
        await postSystem(groupId, `${next.user.name.split(' ')[0]} is now the host`);
        await notify(next.userId, 'INFO', 'You are now the host', `${first} left, so you now host this crew.`, `/trips/${groupId}`);
      }
    }
    if (!groupCancelled) {
      await promoteWaitlist(groupId); // auto-reshuffle: top waitlisted student gets the seat
      await recalcFare(groupId); // everyone's split is recalculated
    }
  }
  if (!groupCancelled) await touchGroup(groupId);
  return { penalty, waived: delayed && wasJoined, groupCancelled, newHostId };
}

export const isHost = (g: { creatorId: string }, u: { id: string }) => g.creatorId === u.id;
export { fromMinutes };
