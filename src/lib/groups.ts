import type { Operator, Place, User } from '@prisma/client';
import { db } from './db';
import { VEHICLE_SPECS, type VehicleType } from './constants';
import { splitFare, upiLink } from './fare';
import { roadKm } from './geo';
import { activeMembers, loadGroup, placesMap, type GroupWithMembers } from './matching/engine';
import { isDemoMode } from './config';

export const firstName = (n: string) => n.split(' ')[0];

export const placeDTO = (p: Place | undefined) => (p ? { id: p.id, code: p.code, name: p.name, kind: p.kind, city: p.city, lat: p.lat, lng: p.lng } : null);

export type GroupDTO = ReturnType<typeof serializeGroupSync>;

export function serializeGroupSync(g: GroupWithMembers & { operator?: Operator | null }, viewer: User | null, places: Map<string, Place>, scoreInfo?: { total: number; eligible: boolean; reasons: string[]; blockers: string[]; nightSafety: boolean }) {
  const me = viewer ? g.members.find((m) => m.userId === viewer.id && m.status !== 'LEFT') : undefined;
  const isMember = !!me && me.status === 'JOINED';
  const isHost = !!viewer && g.creatorId === viewer.id;
  const joined = activeMembers(g);
  const host = g.members.find((m) => m.userId === g.creatorId)?.user;
  const bagsUsed = joined.reduce((s, m) => s + m.luggage, 0);
  const origin = places.get(g.originId);
  const dest = places.get(g.destId);
  const km = origin && dest ? roadKm(origin, dest) : 0;
  const counted = g.status === 'COMPLETED' ? joined.filter((m) => m.boarded) : joined;
  const split = g.fareTotal != null ? splitFare(g.fareTotal, counted.length || 1, g.feePerRider) : null;
  const upi = split && host?.upiId && viewer
    ? upiLink({ pa: host.upiId, pn: host.name, amount: split.perRider, note: 'CampusCrew' })
    : null;

  return {
    id: g.id,
    origin: placeDTO(origin), dest: placeDTO(dest), km,
    date: g.date, windowStart: g.windowStart, windowEnd: g.windowEnd,
    mode: g.mode, vehicleType: g.vehicleType, vehicleLabel: VEHICLE_SPECS[(g.vehicleType as VehicleType)]?.label ?? g.vehicleType,
    seats: g.seats, seatsLeft: Math.max(0, g.seats - joined.length), bagCapacity: g.bagCapacity, bagsUsed,
    genderPref: g.genderPref, nightMode: g.nightMode, status: g.status,
    trainNumber: g.trainNumber, flightNumber: g.flightNumber, delayMins: g.delayMins,
    fareTotal: g.fareTotal, feePerRider: g.feePerRider, split,
    startedAt: g.startedAt?.toISOString() ?? null, completedAt: g.completedAt?.toISOString() ?? null,
    parentGroupId: g.parentGroupId, note: g.note, createdAt: g.createdAt.toISOString(),
    hostId: g.creatorId, hostName: host ? firstName(host.name) : '—',
    isHost, isMember, myStatus: me?.status ?? null,
    me: me ? { boarded: me.boarded, paymentStatus: me.paymentStatus, shareAmount: me.shareAmount, luggage: me.luggage } : null,
    waitlistCount: g.members.filter((m) => m.status === 'WAITLIST').length,
    members: g.members.filter((m) => m.status !== 'LEFT' && (m.status === 'JOINED' || isMember || m.userId === viewer?.id)).map((m) => ({
      userId: m.userId,
      name: isMember || viewer?.role === 'ADMIN' ? m.user.name : firstName(m.user.name),
      firstName: firstName(m.user.name),
      department: m.user.department, year: m.user.year, hostel: m.user.hostel, gender: m.user.gender === 'FEMALE' ? 'F' : m.user.gender === 'MALE' ? 'M' : 'O',
      trustScore: m.user.trustScore, verified: m.user.idCardStatus === 'VERIFIED',
      status: m.status, isHost: m.userId === g.creatorId, luggage: m.luggage, boarded: m.boarded,
      paymentStatus: isMember ? m.paymentStatus : undefined, shareAmount: isMember ? m.shareAmount : undefined,
    })),
    operator: isMember && g.operator ? { name: g.operator.name, plate: g.operator.plate, badge: g.operator.badge, vehicleName: g.operator.vehicleName, rating: g.operator.rating, phoneMasked: g.operator.phoneMasked } : null,
    operatorPreview: !isMember && g.operator ? { badge: g.operator.badge, vehicleName: g.operator.vehicleName } : null,
    pin: isMember && isHost ? g.pin : null,
    demoPin: isMember && !isHost && isDemoMode() ? g.pin : null,
    shareToken: isMember ? g.shareToken : null,
    upi, upiPayee: host ? { name: host.name, upiId: host.upiId } : null,
    score: scoreInfo ?? null,
  };
}

export async function serializeGroup(g: GroupWithMembers, viewer: User | null, scoreInfo?: Parameters<typeof serializeGroupSync>[3]) {
  const places = await placesMap();
  const full = g.operatorId ? { ...g, operator: await db.operator.findUnique({ where: { id: g.operatorId } }) } : g;
  return serializeGroupSync(full as never, viewer, places, scoreInfo);
}

export async function serializeById(id: string, viewer: User | null) {
  return serializeGroup(await loadGroup(id), viewer);
}

export const messageDTO = (m: { id: string; kind: string; body: string; createdAt: Date; userId: string | null; user: { name: string } | null }) => ({
  id: m.id, kind: m.kind, body: m.body, createdAt: m.createdAt.toISOString(), userId: m.userId, author: m.user ? m.user.name.split(' ')[0] : null,
});
