import test from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS, fillScore, fitsCapacity, scoreMatch, timeScore, type GroupLite } from '../src/lib/matching/scoring';

const member = (o: Partial<GroupLite['members'][0]> = {}) => ({ trustScore: 90, hostel: 'BH-3', completedRides: 4, punctualCount: 4, luggage: 1, ...o });
const group = (o: Partial<GroupLite> = {}): GroupLite => ({ window: { start: '16:00', end: '17:30' }, seats: 4, bagCapacity: 4, members: [member(), member()], ...o });
const rider = (o = {}) => ({ window: { start: '16:00', end: '17:30' }, trustScore: 92, hostel: 'BH-3', luggage: 1, completedRides: 5, punctualCount: 4, ...o });

test('weights are 35/25/25/15 and sum to 1', () => {
  assert.deepEqual(WEIGHTS, { time: 0.35, fill: 0.25, trust: 0.25, affinity: 0.15 });
  assert.ok(Math.abs(WEIGHTS.time + WEIGHTS.fill + WEIGHTS.trust + WEIGHTS.affinity - 1) < 1e-9);
});
test('time score: identical windows = 1, partial < 1, disjoint far apart = 0', () => {
  assert.equal(timeScore({ start: '16:00', end: '17:30' }, { start: '16:00', end: '17:30' }), 1);
  const partial = timeScore({ start: '16:00', end: '17:30' }, { start: '17:00', end: '18:30' });
  assert.ok(partial > 0 && partial < 1);
  assert.equal(timeScore({ start: '08:00', end: '09:00' }, { start: '16:00', end: '17:00' }), 0);
});
test('cab never over-booked on seats or luggage', () => {
  assert.equal(fitsCapacity(group({ members: [member(), member(), member(), member()] }), { luggage: 0 }).ok, false);
  assert.equal(fitsCapacity(group({ members: [member({ luggage: 2 }), member({ luggage: 1 })] }), { luggage: 1 }).ok, true); // exactly 4 bags
  const over = fitsCapacity(group({ members: [member({ luggage: 2 }), member({ luggage: 1 })] }), { luggage: 2 });
  assert.equal(over.ok, false);
  assert.match(over.reason ?? '', /luggage/i);
});
test('fill score prefers filling the last seat', () => {
  assert.ok(fillScore(group({ members: [member(), member(), member()] }), { luggage: 0 }) > fillScore(group({ members: [member()] }), { luggage: 0 }));
});
test('eligible strong match scores high; no overlap is ineligible', () => {
  const good = scoreMatch(group(), rider());
  assert.equal(good.eligible, true);
  assert.ok(good.total > 70, `score ${good.total}`);
  const none = scoreMatch(group(), rider({ window: { start: '06:00', end: '07:00' } }));
  assert.equal(none.eligible, false);
});
test('trust < 70 is deprioritised (score x0.6)', () => {
  const hi = scoreMatch(group(), rider({ trustScore: 92 }));
  const lo = scoreMatch(group(), rider({ trustScore: 64 }));
  assert.ok(lo.total < hi.total * 0.75);
  assert.ok(lo.reasons.some((r) => /lower/i.test(r)));
});
test('night mode flags safety, boosts same-hostel + trusted crews, and blocks low trust', () => {
  const night = group({ window: { start: '22:00', end: '23:00' } });
  const same = scoreMatch(night, rider({ window: { start: '22:00', end: '23:00' } }));
  const other = scoreMatch(night, rider({ window: { start: '22:00', end: '23:00' }, hostel: 'GH-1' }));
  assert.equal(same.nightSafety, true);
  assert.ok(same.reasons.includes('Night Safety Mode Active'));
  assert.ok(same.parts.affinity > other.parts.affinity);
  const low = scoreMatch(night, rider({ window: { start: '22:00', end: '23:00' }, trustScore: 64 }));
  assert.equal(low.eligible, false);
});
