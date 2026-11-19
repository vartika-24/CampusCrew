// Trip lifecycle transitions: confirm -> start -> complete, plus boarding by PIN.
import type { User } from '@prisma/client';
import { db } from './db';
import { conflict, forbidden, ApiError, bad } from './api';
import { activeMembers, loadGroup, postSystem, recalcFare, touchGroup } from './matching/engine';
import { recomputeTrust } from './safety/guards';
import { notify } from './notify';

const pinAttempts = new Map<string, { n: number; until: number }>();

export async function boardWithPin(user: User, groupId: string, pin: string) {
  const g = await loadGroup(groupId);
  const me = activeMembers(g).find((m) => m.userId === user.id);
  if (!me) throw forbidden('Only riders in this trip can board');
  if (!['OPEN', 'CONFIRMED', 'IN_PROGRESS'].includes(g.status)) throw conflict('This trip is not boarding');
  if (me.boarded) return { boarded: true, already: true };

  const key = `${user.id}:${groupId}`;
  const rec = pinAttempts.get(key);
  if (rec && rec.n >= 5 && rec.until > Date.now()) throw new ApiError(429, 'Too many wrong PIN attempts. Wait a few minutes.', 'RATE_LIMITED');
  if (!/^\d{4}$/.test(pin)) throw bad('Trip PIN is 4 digits');
  if (pin !== g.pin) {
    const n = (rec && rec.until > Date.now() ? rec.n : 0) + 1;
    pinAttempts.set(key, { n, until: Date.now() + 5 * 60_000 });
    throw new ApiError(400, `Wrong PIN (${Math.max(0, 5 - n)} attempts left)`, 'PIN_INVALID');
  }
  pinAttempts.delete(key);
  await db.groupMember.update({ where: { id: me.id }, data: { boarded: true, boardedAt: new Date() } });
  await postSystem(groupId, `${user.name.split(' ')[0]} boarded (PIN verified) ✅`);
  return { boarded: true, already: false };
}

export async function transition(user: User, groupId: string, action: 'confirm' | 'start' | 'restart' | 'complete' | 'cancel') {
  const g = await loadGroup(groupId);
  if (g.creatorId !== user.id) throw forbidden('Only the host can do this');
  const joined = activeMembers(g);

  if (action === 'confirm') {
    if (g.status !== 'OPEN') throw conflict('Crew is already confirmed');
    if (joined.length < 2) throw conflict('Need at least 2 riders to confirm the crew');
    await db.tripGroup.update({ where: { id: groupId }, data: { status: 'CONFIRMED' } });
    await postSystem(groupId, `Crew confirmed with ${joined.length} riders. Be at the pickup point on time.`);
    for (const m of joined) if (m.userId !== user.id) await notify(m.userId, 'INFO', 'Crew confirmed', 'Your crew is locked in. Check the pickup window.', `/trips/${groupId}`);
  } else if (action === 'start' || action === 'restart') {
    if (action === 'restart' && g.status !== 'IN_PROGRESS') throw conflict('Trip is not in progress');
    if (action === 'start' && !['OPEN', 'CONFIRMED'].includes(g.status)) throw conflict('Trip cannot be started now');
    if (!joined.some((m) => m.boarded)) throw conflict('At least one rider must confirm boarding with the PIN first', 'NOBODY_BOARDED');
    await db.tripGroup.update({ where: { id: groupId }, data: { status: 'IN_PROGRESS', startedAt: new Date() } });
    await postSystem(groupId, action === 'restart' ? 'Live simulation restarted.' : 'Ride started — live location is being shared. 🚗');
  } else if (action === 'complete') {
    if (g.status !== 'IN_PROGRESS') throw conflict('Only a trip in progress can be completed');
    await db.tripGroup.update({ where: { id: groupId }, data: { status: 'COMPLETED', completedAt: new Date() } });
    const rode = joined.filter((m) => m.boarded);
    for (const m of rode) {
      await db.user.update({ where: { id: m.userId }, data: { completedRides: { increment: 1 } } });
      if (m.segmentId) await db.tripSegment.update({ where: { id: m.segmentId }, data: { status: 'COMPLETED' } });
      await recomputeTrust(m.userId);
      await notify(m.userId, 'INFO', 'Trip completed 🎉', 'Rate your co-riders and settle the fare split.', `/trips/${groupId}`);
    }
    for (const m of joined.filter((x) => !x.boarded)) if (m.segmentId) await db.tripSegment.update({ where: { id: m.segmentId }, data: { status: 'CANCELLED' } });
    await postSystem(groupId, 'Trip completed. Please rate co-riders and settle the fare split.');
    await recalcFare(groupId);
  } else if (action === 'cancel') {
    if (!['OPEN', 'CONFIRMED'].includes(g.status)) throw conflict('This trip cannot be cancelled now');
    await db.tripGroup.update({ where: { id: groupId }, data: { status: 'CANCELLED' } });
    for (const m of g.members.filter((x) => x.status !== 'LEFT')) {
      if (m.segmentId) await db.tripSegment.update({ where: { id: m.segmentId }, data: { status: 'CANCELLED', groupId: null } });
      if (m.userId !== user.id) await notify(m.userId, 'INFO', 'Trip cancelled by host', 'Find another crew from the Trips tab.', '/trips');
    }
    await postSystem(groupId, 'The host cancelled this trip.');
  }
  await touchGroup(groupId);
  return { status: (await loadGroup(groupId)).status };
}
