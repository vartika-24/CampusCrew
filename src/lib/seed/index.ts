import { randomBytes } from 'node:crypto';
import { db } from '../db';
import { computeTrust } from '../safety/trust';
import { splitFare } from '../fare';
import { addDays, fromMinutes, istInstant, todayIST } from '../time';
import { isNightWindow } from '../matching/scoring';
import { ADMIN, DEMO, EXTRAS, OPERATORS, PLACES, type Student } from './data';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const token = () => randomBytes(18).toString('base64url');
const pin = (r: () => number) => String(Math.floor(r() * 10000)).padStart(4, '0');

const SPEC = { SEDAN4: { seats: 4, bags: 4 }, SUV6: { seats: 6, bags: 6 }, AUTO: { seats: 3, bags: 3 }, SHARED: { seats: 6, bags: 99 } } as const;

type Hist = { host: string; members: string[]; from: string; to: string; day: number; mode?: string; veh?: keyof typeof SPEC; fare: number; pref?: string; start: string; end: string; unpaid?: string[] };

export async function wipe() {
  for (const t of ['notification', 'rating', 'emergencyAlert', 'report', 'message', 'groupMember', 'tripSegment', 'tripGroup', 'journey', 'buddyEntry', 'demandSnapshot', 'otpCode', 'operator', 'place', 'user', 'setting'] as const) {
    await (db[t] as unknown as { deleteMany: () => Promise<unknown> }).deleteMany();
  }
}

export async function ensureSeeded(): Promise<boolean> {
  if ((await db.user.count()) > 0) return false;
  await runSeed();
  return true;
}

export async function runSeed(): Promise<void> {
  const now = new Date();
  const T = todayIST(now);
  const D = (n: number) => addDays(T, n);
  const r = rng(20261119);

  // ---- Places & operators
  const placeId: Record<string, string> = {};
  for (const p of PLACES) placeId[p.code] = (await db.place.create({ data: { ...p, isPublic: true } })).id;
  const opByPlate: Record<string, string> = {};
  for (const o of OPERATORS) opByPlate[o.plate] = (await db.operator.create({ data: o })).id;
  const opFor = (veh: string, i: number) => {
    const list = OPERATORS.filter((o) => o.vehicleType === veh);
    return list.length ? opByPlate[list[i % list.length].plate] : null;
  };

  // ---- Users
  const uid: Record<string, string> = {};
  const all: Student[] = [...DEMO, ...EXTRAS];
  for (const s of all) {
    const u = await db.user.create({
      data: {
        email: s.email, name: s.name, rollNumber: s.roll, department: s.dept, year: s.year, hostel: s.hostel,
        gender: s.gender, genderLocked: true, emailVerified: true, idCardStatus: 'VERIFIED', upiId: s.upi,
        buddyVisible: !!s.buddy, trustScore: 50, createdAt: new Date(now.getTime() - 90 * 86400000),
      },
    });
    uid[s.key] = u.id;
  }
  const admin = await db.user.create({
    data: { email: ADMIN.email, name: ADMIN.name, rollNumber: ADMIN.roll, department: ADMIN.dept, year: 1, hostel: null, gender: 'OTHER', genderLocked: true, role: 'ADMIN', emailVerified: true, idCardStatus: 'VERIFIED', trustScore: 100 },
  });

  // ---- Historical completed shared trips (drive eco/savings + ride counters)
  const H: Hist[] = [
    { host: 'Sn', members: ['A', 'Me', 'Di'], from: 'IIITA-GH', to: 'PRYJ', day: -44, fare: 380, pref: 'GIRLS_ONLY', start: '09:00', end: '10:30' },
    { host: 'Ad', members: ['R', 'K', 'Ha'], from: 'IIITA-G1', to: 'PRYJ', day: -40, fare: 360, start: '16:00', end: '17:30' },
    { host: 'Ar', members: ['R', 'Vi', 'Si', 'Ka'], from: 'IIITA-BH', to: 'IXD', day: -37, fare: 880, veh: 'SUV6', start: '05:30', end: '07:00' },
    { host: 'A', members: ['Pr', 'Ai'], from: 'IIITA-GH', to: 'PRYJ', day: -34, fare: 340, pref: 'GIRLS_ONLY', start: '10:00', end: '11:30' },
    { host: 'K', members: ['Mo', 'Ni'], from: 'IIITA-G1', to: 'SFG', day: -30, fare: 160, mode: 'AUTO', veh: 'AUTO', start: '14:00', end: '15:00' },
    { host: 'Ta', members: ['A', 'Ri'], from: 'IIITA-GH', to: 'PRYG-CL', day: -27, fare: 400, pref: 'GIRLS_ONLY', start: '11:00', end: '12:30' },
    { host: 'R', members: ['K', 'Ad', 'Ni'], from: 'IIITA-G1', to: 'PRYJ', day: -24, fare: 360, start: '17:00', end: '18:30' },
    { host: 'Ri', members: ['A', 'Is', 'Sn'], from: 'IIITA-GH', to: 'PRYJ', day: -21, fare: 340, pref: 'GIRLS_ONLY', start: '08:00', end: '09:30' },
    { host: 'Ha', members: ['R', 'Mo', 'Si'], from: 'IIITA-BH', to: 'PRYJ', day: -18, fare: 360, start: '15:00', end: '16:30' },
    { host: 'A', members: ['Pr', 'Di', 'Me', 'Is'], from: 'IIITA-GH', to: 'IXD', day: -15, fare: 900, veh: 'SUV6', pref: 'GIRLS_ONLY', start: '06:00', end: '07:30' },
    { host: 'K', members: ['Vi', 'Ka'], from: 'JHALWA', to: 'PRYJ', day: -12, fare: 140, mode: 'AUTO', veh: 'AUTO', start: '12:00', end: '13:00' },
    { host: 'Ad', members: ['R', 'K', 'Ar'], from: 'IIITA-BH', to: 'PRYJ', day: -9, fare: 360, start: '18:00', end: '19:30' },
    { host: 'Sn', members: ['A', 'Ai', 'Ta'], from: 'IIITA-GH', to: 'PRYJ', day: -6, fare: 340, pref: 'GIRLS_ONLY', start: '09:30', end: '11:00' },
    { host: 'Vi', members: ['Si', 'Ka', 'Mo'], from: 'IIITA-BH', to: 'PRYJ', day: -5, fare: 360, start: '13:00', end: '14:30' },
    { host: 'Pr', members: ['Me', 'Di', 'Ri'], from: 'IIITA-GH', to: 'PRYJ', day: -3, fare: 340, pref: 'GIRLS_ONLY', start: '10:00', end: '11:30' },
    { host: 'Ha', members: ['Ni', 'Ar', 'Ad'], from: 'IIITA-G1', to: 'IXD', day: -2, fare: 420, start: '07:00', end: '08:30' },
    { host: 'Ar', members: ['Mo', 'Ni', 'Ha'], from: 'IIITA-BH', to: 'PRYJ', day: -1, fare: 360, start: '15:30', end: '17:00', unpaid: ['Mo'] },
  ];
  const ridesOf: Record<string, number> = {};
  const histGroups: string[] = [];
  let opIdx = 0;
  for (const h of H) {
    const mode = h.mode ?? 'CAB';
    const veh = h.veh ?? (mode === 'AUTO' ? 'AUTO' : 'SEDAN4');
    const people = [h.host, ...h.members];
    const split = splitFare(h.fare, people.length);
    const when = istInstant(D(h.day), h.start);
    const g = await db.tripGroup.create({
      data: {
        creatorId: uid[h.host], originId: placeId[h.from], destId: placeId[h.to], date: D(h.day), windowStart: h.start, windowEnd: h.end,
        mode, vehicleType: veh, seats: SPEC[veh].seats, bagCapacity: SPEC[veh].bags, genderPref: h.pref ?? 'MIXED',
        status: 'COMPLETED', pin: pin(r), shareToken: token(), operatorId: opFor(veh, opIdx++), fareTotal: h.fare,
        startedAt: when, completedAt: new Date(when.getTime() + 55 * 60000), createdAt: new Date(when.getTime() - 3 * 86400000),
      },
    });
    histGroups.push(g.id);
    for (const p of people) {
      const unpaid = h.unpaid?.includes(p) ?? false;
      await db.groupMember.create({
        data: {
          groupId: g.id, userId: uid[p], status: 'JOINED', boarded: true, boardedAt: when, luggage: Math.floor(r() * 3),
          shareAmount: split.perRider, paymentStatus: p === h.host || !unpaid ? 'PAID' : 'UNPAID', paidAt: unpaid ? null : when,
          joinedAt: new Date(when.getTime() - 2 * 86400000),
        },
      });
      ridesOf[p] = (ridesOf[p] ?? 0) + 1;
    }
    await db.message.create({ data: { groupId: g.id, kind: 'SYSTEM', body: 'Trip completed. Fare split settled.', createdAt: g.completedAt! } });
  }

  // ---- Trust counters (pinned so demo accounts land on 96 / 92 / 64)
  const counters: Record<string, { rs: number; rc: number; p: number; cc: number; lc: number }> = {
    A: { rs: 27, rc: 6, p: 5, cc: 0, lc: 0 }, // 50+25+11+10 = 96
    R: { rs: 21, rc: 5, p: 4, cc: 0, lc: 0 }, // 50+25+9+8  = 92
    K: { rs: 18, rc: 5, p: 2, cc: 2, lc: 1 }, // 50+25+5+4-15-5 = 64
  };
  for (const s of all) {
    const rides = ridesOf[s.key] ?? 0;
    const c = counters[s.key] ?? { rs: Math.round(rides * (3.8 + r() * 1.1)), rc: rides, p: Math.max(0, rides - Math.floor(r() * 2)), cc: 0, lc: 0 };
    if (s.key === 'Mo') { c.cc = 1; }
    await db.user.update({ where: { id: uid[s.key] }, data: { completedRides: rides, ratingSum: c.rs, ratingCount: c.rc, punctualCount: c.p, cancelCount: c.cc, lateCancels: c.lc } });
  }

  // ---- Upcoming trips around the End-Semester break
  const mkGroup = async (o: {
    host: string; members: string[]; waitlist?: string[]; from: string; to: string; day: number; start: string; end: string; mode?: string; veh?: keyof typeof SPEC;
    pref?: string; status?: string; train?: string; flight?: string; fare?: number; plate?: string; parent?: string; note?: string; startedAgoSec?: number; boarded?: boolean;
    luggage?: Record<string, number>; parentGroupId?: string;
  }) => {
    const mode = o.mode ?? 'CAB';
    const veh = o.veh ?? (mode === 'AUTO' ? 'AUTO' : mode === 'CAB' ? 'SEDAN4' : 'SHARED');
    const op = mode === 'CAB' || mode === 'AUTO' ? (o.plate ? opByPlate[o.plate] : opFor(veh, opIdx++)) : null;
    const g = await db.tripGroup.create({
      data: {
        creatorId: uid[o.host], originId: placeId[o.from], destId: placeId[o.to], date: D(o.day), windowStart: o.start, windowEnd: o.end,
        mode, vehicleType: veh, seats: SPEC[veh].seats, bagCapacity: SPEC[veh].bags, genderPref: o.pref ?? 'MIXED',
        nightMode: isNightWindow({ start: o.start, end: o.end }), status: o.status ?? 'OPEN', pin: pin(r), shareToken: token(), operatorId: op,
        trainNumber: o.train ?? null, flightNumber: o.flight ?? null, fareTotal: o.fare ?? null,
        startedAt: o.startedAgoSec != null ? new Date(Date.now() - o.startedAgoSec * 1000) : null, parentGroupId: o.parentGroupId ?? null, note: o.note ?? null,
        createdAt: new Date(now.getTime() - (1 + Math.floor(r() * 4)) * 86400000),
      },
    });
    const joined = [o.host, ...o.members];
    const split = o.fare ? splitFare(o.fare, joined.length) : null;
    for (const p of joined) {
      const lug = o.luggage?.[p] ?? Math.floor(r() * 3);
      const seg = await seg_(p, g.id, { from: o.from, to: o.to, day: o.day, start: o.start, end: o.end, mode, veh, pref: o.pref ?? 'MIXED', lug, train: o.train, flight: o.flight, status: 'MATCHED' });
      await db.groupMember.create({
        data: { groupId: g.id, userId: uid[p], segmentId: seg, status: 'JOINED', luggage: lug, boarded: !!o.boarded, boardedAt: o.boarded ? new Date() : null, shareAmount: split?.perRider ?? 0, paymentStatus: p === o.host ? 'PAID' : 'UNPAID' },
      });
    }
    for (const p of o.waitlist ?? []) {
      const lug = o.luggage?.[p] ?? 1;
      const seg = await seg_(p, g.id, { from: o.from, to: o.to, day: o.day, start: o.start, end: o.end, mode, veh, pref: o.pref ?? 'MIXED', lug, train: o.train, flight: o.flight, status: 'WAITLISTED' });
      await db.groupMember.create({ data: { groupId: g.id, userId: uid[p], segmentId: seg, status: 'WAITLIST', luggage: lug } });
    }
    return g;
  };

  const journeys: Record<string, string> = {};
  const seq: Record<string, number> = {};
  async function seg_(p: string, groupId: string, s: { from: string; to: string; day: number; start: string; end: string; mode: string; veh: string; pref: string; lug: number; train?: string; flight?: string; status: string; jkey?: string; title?: string }) {
    const jk = `${p}:${s.jkey ?? groupId}`;
    if (!journeys[jk]) {
      journeys[jk] = (await db.journey.create({ data: { ownerId: uid[p], title: s.title ?? `${PLACES.find((x) => x.code === s.from)!.name.split(' (')[0]} → ${PLACES.find((x) => x.code === s.to)!.name.split(' (')[0]}` } })).id;
      seq[jk] = 0;
    }
    seq[jk]++;
    return (await db.tripSegment.create({
      data: {
        journeyId: journeys[jk], userId: uid[p], seq: seq[jk], originId: placeId[s.from], destId: placeId[s.to], date: D(s.day), windowStart: s.start, windowEnd: s.end,
        mode: s.mode, vehicleType: s.veh, luggage: s.lug, genderPref: s.pref, trainNumber: s.train ?? null, flightNumber: s.flight ?? null, status: s.status, groupId,
      },
    })).id;
  }

  // Multi-leg journeys share a journey key so legs chain under one Journey.
  const chain = async (p: string, title: string, legs: Parameters<typeof mkGroup>[0][]) => {
    const jid = (await db.journey.create({ data: { ownerId: uid[p], title } })).id;
    let i = 0;
    const out = [];
    for (const l of legs) {
      const g = await mkGroup(l);
      // re-point host/member segments of this person to the shared journey
      const seg = await db.tripSegment.findFirst({ where: { groupId: g.id, userId: uid[p] } });
      if (seg) await db.tripSegment.update({ where: { id: seg.id }, data: { journeyId: jid, seq: ++i } });
      out.push(g);
    }
    return out;
  };

  // Ananya: 3-leg journey home (Cab -> Train 12451 -> Auto)
  const [aLeg1, aLeg2, aLeg3] = await chain('A', 'Home to Kanpur — End-Sem Break', [
    { host: 'A', members: ['Sn', 'Me'], from: 'IIITA-G1', to: 'PRYJ', day: 2, start: '16:00', end: '17:30', pref: 'GIRLS_ONLY', status: 'CONFIRMED', plate: 'UP-70-GT-4821', luggage: { A: 2, Sn: 1, Me: 1 } },
    { host: 'A', members: ['Sn', 'Me'], from: 'PRYJ', to: 'CNB', day: 2, start: '18:45', end: '19:15', mode: 'TRAIN', pref: 'GIRLS_ONLY', train: '12451', status: 'OPEN', luggage: { A: 0, Sn: 0, Me: 0 } },
    { host: 'A', members: [], from: 'CNB', to: 'KNP-HOME', day: 2, start: '22:40', end: '23:10', mode: 'AUTO', pref: 'GIRLS_ONLY', status: 'OPEN', luggage: { A: 2 } },
  ]);
  // Rohan: Cab (full SUV, Kabir waitlisted) -> Train 12417
  const [rLeg1, rLeg2] = await chain('R', 'Delhi via Prayagraj — End-Sem Break', [
    { host: 'R', members: ['Ad', 'Ha', 'Si', 'Ni'], waitlist: ['K'], from: 'IIITA-G1', to: 'PRYJ', day: 2, start: '17:00', end: '18:30', veh: 'SUV6', status: 'CONFIRMED', plate: 'UP-70-HT-1156', luggage: { R: 1, Ad: 1, Ha: 1, Si: 1, Ni: 1, K: 2 } },
    { host: 'R', members: ['Ad', 'Ha'], from: 'PRYJ', to: 'NDLS', day: 2, start: '20:00', end: '20:40', mode: 'TRAIN', train: '12417', status: 'OPEN' },
  ]);
  void aLeg1; void aLeg2; void aLeg3; void rLeg2;

  const airport = await mkGroup({ host: 'Ka', members: ['Vi', 'K'], from: 'IIITA-G1', to: 'IXD', day: 3, start: '06:00', end: '07:00', flight: '6E-2134', status: 'OPEN', luggage: { Ka: 1, Vi: 1, K: 1 } });
  const night = await mkGroup({ host: 'Ha', members: ['Ad', 'Ni'], from: 'IIITA-BH', to: 'PRYJ', day: 2, start: '22:00', end: '23:00', status: 'OPEN', luggage: { Ha: 1, Ad: 1, Ni: 0 } });
  const girlsAm = await mkGroup({ host: 'Ri', members: ['Di', 'Is'], from: 'IIITA-GH', to: 'PRYJ', day: 1, start: '09:00', end: '10:30', pref: 'GIRLS_ONLY', status: 'OPEN' });
  await mkGroup({ host: 'Ni', members: ['Mo'], from: 'IIITA-G1', to: 'SFG', day: 1, start: '11:00', end: '12:00', mode: 'AUTO', status: 'OPEN' });
  await mkGroup({ host: 'Si', members: ['Vi'], from: 'JHALWA', to: 'PRYG-CL', day: 1, start: '13:00', end: '14:00', mode: 'BUS', status: 'OPEN' });
  await mkGroup({ host: 'Si', members: ['Ar', 'Ni', 'Ha'], from: 'IIITA-G1', to: 'CNB', day: 3, start: '07:00', end: '09:00', veh: 'SUV6', status: 'OPEN', luggage: { Si: 2, Ar: 2, Ni: 1, Ha: 1 } });
  await mkGroup({ host: 'Ai', members: ['Ta'], from: 'IIITA-GH', to: 'CNB', day: 2, start: '08:00', end: '10:00', pref: 'GIRLS_ONLY', status: 'OPEN' });
  await mkGroup({ host: 'Ha', members: ['Ar'], from: 'IIITA-G1', to: 'PRYJ', day: 4, start: '10:00', end: '11:30', status: 'OPEN' });
  await mkGroup({ host: 'Pr', members: ['Me'], from: 'IIITA-GH', to: 'IXD', day: 4, start: '12:00', end: '13:30', pref: 'GIRLS_ONLY', veh: 'SEDAN4', status: 'OPEN' });
  await mkGroup({ host: 'Ad', members: ['Ha', 'Ni'], from: 'PRYJ', to: 'IIITA-G1', day: 14, start: '18:00', end: '19:30', status: 'OPEN', parentGroupId: rLeg1.id, note: 'Return sync — semester resumes' });
  await mkGroup({ host: 'Ar', members: ['Vi'], from: 'IIITA-BH', to: 'NDLS', day: 3, start: '06:00', end: '08:00', mode: 'TRAIN', train: '12559', status: 'OPEN' });

  // Live, in-progress ride (for live tracking + SOS demo): Rohan, Ananya, Vikram, Arjun
  const nowIst = new Date(now.getTime() + 5.5 * 3600000);
  const nowMin = nowIst.getUTCHours() * 60 + nowIst.getUTCMinutes();
  const live = await mkGroup({
    host: 'Vi', members: ['R', 'A', 'Ar'], from: 'IIITA-G1', to: 'PRYJ', day: 0,
    start: fromMinutes(Math.max(0, nowMin - 45)), end: fromMinutes(Math.min(1439, Math.max(nowMin + 30, 60))),
    status: 'IN_PROGRESS', startedAgoSec: 90, boarded: true, plate: 'UP-70-BN-2290', fare: 360, note: 'Live demo ride',
  });

  // ---- Chat messages
  const say = async (g: { id: string }, who: string | null, body: string, minsAgo: number) =>
    db.message.create({ data: { groupId: g.id, userId: who ? uid[who] : null, kind: who ? 'USER' : 'SYSTEM', body, createdAt: new Date(now.getTime() - minsAgo * 60000) } });
  await say(aLeg1, null, 'Ananya started this crew.', 600);
  await say(aLeg1, 'A', 'Hi girls! Meeting at Gate 1 at 3:50 PM. Please keep luggage ready 🧳', 420);
  await say(aLeg1, 'Sn', 'Perfect, I will be there. Two bags only!', 395);
  await say(aLeg1, null, 'Meera joined the cab', 380);
  await say(aLeg1, 'Me', 'Thanks for adding me 🙏 Will share UPI after the ride.', 360);
  await say(aLeg1, null, 'Train 12451 is running on time. Pickup window unchanged.', 90);
  await say(rLeg1, null, 'Rohan started this crew.', 700);
  await say(rLeg1, 'R', 'SUV is booked: Innova Crysta, UP-70-HT-1156. 6 seats, trunk fits 6 bags.', 600);
  await say(rLeg1, 'Ad', 'I will carry one big bag. Ok?', 560);
  await say(rLeg1, 'Ha', 'Same here. Gate 1 at 4:45 PM?', 540);
  await say(rLeg1, null, 'Kabir joined the waitlist', 300);
  await say(rLeg1, 'R', 'Crew is full — if anyone drops, Kabir gets promoted automatically.', 290);
  await say(night, null, 'Harsh started this crew — Night Safety Mode Active 🌙', 240);
  await say(night, 'Ha', 'Late train 12301 at 22:50 — we all go from BH circle together.', 200);
  await say(night, 'Ad', 'Same hostel (BH-3), will walk to the pickup together.', 190);
  await say(airport, null, 'Karan started this crew.', 500);
  await say(airport, 'Ka', 'Flight 6E-2134 departs 09:40. Cab at 6 AM sharp.', 480);
  await say(girlsAm, null, 'Riya started this crew.', 300);
  await say(girlsAm, 'Ri', 'Girls-only cab to the station, 9 AM from GH gate.', 280);
  await say(live, null, 'Vikram started this crew.', 120);
  await say(live, 'Vi', 'Driver Sanjay is here. PIN is shared at pickup.', 110);
  await say(live, null, 'Rohan boarded (PIN verified)', 100);
  await say(live, null, 'Ananya boarded (PIN verified)', 99);
  await say(live, null, 'Arjun boarded (PIN verified)', 98);
  await say(live, null, 'Ride started — live location is being shared.', 2);
  await say(live, 'R', 'On our way! Tracking link sent to my parents.', 1);

  // ---- Buddy finder entries (opt-in users only appear in search)
  const buddy = (p: string, kind: string, number: string, day: number) => db.buddyEntry.create({ data: { userId: uid[p], kind, number, date: D(day) } });
  for (const p of ['A', 'Sn', 'Me', 'Ai', 'Ta']) await buddy(p, 'TRAIN', '12451', 2);
  for (const p of ['R', 'Ad', 'Ha', 'Si']) await buddy(p, 'TRAIN', '12417', 2);
  for (const p of ['Pr', 'Ad', 'Vi', 'Mo']) await buddy(p, 'TRAIN', '12301', 2);
  for (const p of ['Ka', 'Vi', 'K']) await buddy(p, 'FLIGHT', '6E-2134', 3);
  await buddy('Si', 'TRAIN', '12301', 2);

  // ---- Reports & SOS history
  const rep = (reporter: string, target: string | null, type: string, description: string, status = 'OPEN', gId?: string, resolution?: string) =>
    db.report.create({ data: { reporterId: uid[reporter], targetId: target ? uid[target] : null, groupId: gId ?? null, type, description, status, resolution: resolution ?? null, resolvedAt: status === 'OPEN' ? null : new Date(now.getTime() - 86400000), createdAt: new Date(now.getTime() - Math.floor(r() * 5 + 1) * 3600000 * 6) } });
  await rep('Ri', 'Is', 'GENDER_MISMATCH', 'Rider on the girls-only cab did not match the verified profile. Driver confirmed a different person boarded.', 'OPEN', histGroups[7]);
  await rep('Ad', 'Mo', 'DISPUTE', 'Has not paid his ₹185 share for the BH → PRYJ cab yesterday despite three reminders.', 'OPEN', histGroups[16]);
  await rep('Ar', 'Ka', 'NO_SHOW', 'Did not turn up at pickup; cab waited 20 minutes.', 'OPEN');
  await rep('Me', 'Ni', 'HARASSMENT', 'Made uncomfortable comments in the group chat.', 'RESOLVED', undefined, 'Warning issued by Student Affairs.');
  await db.emergencyAlert.create({ data: { userId: uid['Ta'], groupId: histGroups[5], lat: 25.4401, lng: 81.7819, note: 'Driver took an unfamiliar route', status: 'RESOLVED', resolvedNote: 'Called driver; route diversion due to flyover work. Rider safe.', resolvedAt: new Date(now.getTime() - 20 * 86400000), createdAt: new Date(now.getTime() - 27 * 86400000) } });

  // ---- Notifications
  await db.notification.create({ data: { userId: uid['A'], kind: 'INFO', title: 'Welcome to CampusCrew', body: 'Your IIITA verification is complete. Gender is locked for everyone’s safety.', link: '/profile' } });
  await db.notification.create({ data: { userId: uid['K'], kind: 'PENALTY', title: 'Trust score notice', body: 'Recent cancellations lowered your score to 64. Rides after 21:00 are restricted below 70.', link: '/profile' } });
  await db.notification.create({ data: { userId: uid['R'], kind: 'INFO', title: 'Crew is full', body: 'Your SUV crew to Prayagraj Junction is full. 1 student is waitlisted.', link: `/trips/${rLeg1.id}` } });

  // ---- Demand index (anonymised aggregate of trip intents across the campus)
  const hubs: { code: string; base: number }[] = [
    { code: 'PRYJ', base: 46 }, { code: 'IXD', base: 14 }, { code: 'SFG', base: 6 }, { code: 'PRYG-CL', base: 7 }, { code: 'CNB', base: 9 }, { code: 'NDLS', base: 8 },
  ];
  const dayFactor: Record<number, number> = { [-2]: 0.18, [-1]: 0.22, 0: 0.3, 1: 0.78, 2: 1.32, 3: 0.92, 4: 0.5, 5: 0.28, 6: 0.18, 7: 0.15 };
  const hourFactor = (h: number) => 0.08 + 0.92 * Math.exp(-((h - 17) ** 2) / 11) + 0.45 * Math.exp(-((h - 7) ** 2) / 4) + 0.3 * Math.exp(-((h - 21) ** 2) / 5);
  const rows: { date: string; hour: number; destId: string; count: number }[] = [];
  for (let d = -2; d <= 7; d++) {
    for (let h = 5; h <= 23; h++) {
      for (const hub of hubs) rows.push({ date: D(d), hour: h, destId: placeId[hub.code], count: Math.max(0, Math.round(hub.base * dayFactor[d] * hourFactor(h) * (0.97 + r() * 0.06))) });
    }
  }
  await db.demandSnapshot.createMany({ data: rows });

  // ---- Settings
  for (const [key, value] of Object.entries({ breakStart: D(1), breakEnd: D(4), breakLabel: 'End-Semester Vacation (post-Diwali peak)', returnDate: D(14), seededAt: now.toISOString() })) {
    await db.setting.create({ data: { key, value } });
  }

  // ---- Final trust recompute from counters + open reports
  const users = await db.user.findMany({ where: { role: 'STUDENT' } });
  for (const u of users) {
    const open = await db.report.count({ where: { targetId: u.id, status: 'OPEN' } });
    const score = computeTrust({
      verified: true, completedRides: u.completedRides, ratingSum: u.ratingSum, ratingCount: u.ratingCount, punctualCount: u.punctualCount,
      cancelCount: u.cancelCount, lateCancels: u.lateCancels, unresolvedReports: open, adminAdjust: u.trustAdjust,
    });
    await db.user.update({ where: { id: u.id }, data: { trustScore: score } });
  }
  void admin;
}
