// Weighted smart-matching scoring. Pure functions (no DB) so they are unit-testable.
//   Time-window overlap ................ 35%
//   Cab-fill & luggage optimisation .... 25%
//   Trust score & punctuality .......... 25%
//   Same-hostel / night-mode affinity .. 15%
import { NIGHT_END, NIGHT_START, TRUST_MIN_NIGHT } from '../constants';
import { gapMinutes, isNightTime, overlapMinutes, toMinutes } from '../time';

export const WEIGHTS = { time: 0.35, fill: 0.25, trust: 0.25, affinity: 0.15 } as const;

export type Window = { start: string; end: string };
export type MemberLite = { trustScore: number; hostel: string | null; completedRides: number; punctualCount: number; luggage: number };
export type GroupLite = {
  window: Window; seats: number; bagCapacity: number; members: MemberLite[]; nightMode?: boolean;
};
export type RiderLite = { trustScore: number; hostel: string | null; luggage: number; completedRides: number; punctualCount: number };

export type ScoreResult = {
  total: number; // 0-100
  eligible: boolean;
  reasons: string[];
  blockers: string[];
  parts: { time: number; fill: number; trust: number; affinity: number }; // each 0-1
  nightSafety: boolean;
};

export function timeScore(a: Window, b: Window): number {
  const overlap = overlapMinutes(a.start, a.end, b.start, b.end);
  const lenA = Math.max(15, toMinutes(a.end) - toMinutes(a.start));
  const lenB = Math.max(15, toMinutes(b.end) - toMinutes(b.start));
  if (overlap > 0) return Math.min(1, overlap / Math.min(lenA, lenB));
  const gap = gapMinutes(a.start, a.end, b.start, b.end);
  // Near-miss windows earn a little credit (<=45 min apart); beyond that nothing.
  return gap <= 45 ? 0.25 * (1 - gap / 45) : 0;
}

export function bagsUsed(members: { luggage: number }[]): number {
  return members.reduce((s, m) => s + m.luggage, 0);
}

export function fitsCapacity(g: Pick<GroupLite, 'seats' | 'bagCapacity' | 'members'>, rider: { luggage: number }): { ok: boolean; reason?: string } {
  if (g.members.length + 1 > g.seats) return { ok: false, reason: 'No seats left' };
  if (bagsUsed(g.members) + rider.luggage > g.bagCapacity) return { ok: false, reason: 'Not enough luggage space' };
  return { ok: true };
}

/** Rewards filling seats while keeping the boot (trunk) from overflowing. */
export function fillScore(g: Pick<GroupLite, 'seats' | 'bagCapacity' | 'members'>, rider: { luggage: number }): number {
  const filledAfter = (g.members.length + 1) / g.seats;
  const bagUtil = g.bagCapacity >= 99 ? 0 : (bagsUsed(g.members) + rider.luggage) / g.bagCapacity;
  // Prefer crews close to full; mildly penalise a trunk that is nearly maxed out.
  const trunkComfort = bagUtil <= 0.75 ? 1 : Math.max(0, 1 - (bagUtil - 0.75) * 2);
  return Math.min(1, 0.75 * filledAfter + 0.25 * trunkComfort);
}

export function groupTrust(g: Pick<GroupLite, 'members'>): { avg: number; punctuality: number } {
  if (g.members.length === 0) return { avg: 70, punctuality: 0.8 };
  const avg = g.members.reduce((s, m) => s + m.trustScore, 0) / g.members.length;
  const rated = g.members.filter((m) => m.completedRides > 0);
  const punctuality = rated.length
    ? rated.reduce((s, m) => s + Math.min(1, m.punctualCount / m.completedRides), 0) / rated.length
    : 0.8;
  return { avg, punctuality };
}

export function trustPart(g: Pick<GroupLite, 'members'>, rider: RiderLite): number {
  const { avg, punctuality } = groupTrust(g);
  const riderPunct = rider.completedRides > 0 ? Math.min(1, rider.punctualCount / rider.completedRides) : 0.8;
  const blendedTrust = (avg * 0.6 + rider.trustScore * 0.4) / 100;
  return Math.max(0, Math.min(1, 0.8 * blendedTrust + 0.2 * ((punctuality + riderPunct) / 2)));
}

export function isNightWindow(w: Window): boolean {
  return isNightTime(w.start, NIGHT_START, NIGHT_END);
}

export function affinityPart(g: Pick<GroupLite, 'members' | 'window'>, rider: RiderLite): { score: number; night: boolean } {
  const night = isNightWindow(g.window);
  const n = g.members.length;
  if (n === 0) return { score: 0.5, night };
  const sameHostel = rider.hostel ? g.members.filter((m) => m.hostel === rider.hostel).length / n : 0;
  const highTrust = g.members.filter((m) => m.trustScore >= 85).length / n;
  if (night) {
    // Night safety: same-hostel and high-trust co-riders dominate.
    const riderBoost = rider.trustScore >= 85 ? 1 : rider.trustScore >= TRUST_MIN_NIGHT ? 0.6 : 0;
    return { score: Math.min(1, 0.5 * sameHostel + 0.3 * highTrust + 0.2 * riderBoost), night };
  }
  return { score: Math.min(1, 0.7 * sameHostel + 0.3 * 0.5), night };
}

/** Score one rider against one candidate group (hard capacity + night-trust gates + weighted score). */
export function scoreMatch(group: GroupLite, rider: RiderLite & { window: Window }): ScoreResult {
  const blockers: string[] = [];
  const reasons: string[] = [];
  const cap = fitsCapacity(group, rider);
  if (!cap.ok && cap.reason) blockers.push(cap.reason);

  const time = timeScore(group.window, rider.window);
  if (time === 0) blockers.push('Time windows do not overlap');
  const fill = fillScore(group, rider);
  const trust = trustPart(group, rider);
  const { score: affinity, night } = affinityPart(group, rider);

  if (night && rider.trustScore < TRUST_MIN_NIGHT) blockers.push(`Trust score below ${TRUST_MIN_NIGHT}: late-night rides restricted`);

  let total = 100 * (WEIGHTS.time * time + WEIGHTS.fill * fill + WEIGHTS.trust * trust + WEIGHTS.affinity * affinity);
  if (rider.trustScore < TRUST_MIN_NIGHT) total *= 0.6; // deprioritised in matching

  if (time >= 0.8) reasons.push('Windows overlap strongly');
  else if (time > 0) reasons.push('Partial time overlap');
  if (group.members.length + 1 === group.seats) reasons.push('Fills the last seat');
  else if (group.members.length > 0) reasons.push(`${group.seats - group.members.length - 1} seat(s) will remain`);
  if (rider.hostel && group.members.some((m) => m.hostel === rider.hostel)) reasons.push(`Same hostel (${rider.hostel}) rider on board`);
  if (trust >= 0.8) reasons.push('High-trust crew');
  if (night) reasons.push('Night Safety Mode Active');
  if (rider.trustScore < TRUST_MIN_NIGHT) reasons.push('Ranked lower: trust score under 70');

  return {
    total: Math.round(total * 10) / 10,
    eligible: blockers.length === 0,
    reasons,
    blockers,
    parts: { time, fill, trust, affinity },
    nightSafety: night,
  };
}
