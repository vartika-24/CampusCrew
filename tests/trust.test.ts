import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTrust, trustBreakdown, TRUST } from '../src/lib/safety/trust';

const base = { verified: true, completedRides: 0, ratingSum: 0, ratingCount: 0, punctualCount: 0, cancelCount: 0, lateCancels: 0, unresolvedReports: 0, adminAdjust: 0 };

test('verified student starts at +50 base', () => assert.equal(computeTrust(base), 50));
test('unverified student has no base', () => assert.equal(computeTrust({ ...base, verified: false }), 0));
test('each completed ride adds +5 (capped at +25)', () => {
  assert.equal(computeTrust({ ...base, completedRides: 2 }), 60);
  assert.equal(computeTrust({ ...base, completedRides: 50 }), 75);
});
test('late cancellation costs 15, unresolved report costs 25', () => {
  assert.equal(computeTrust({ ...base, completedRides: 5, cancelCount: 1, lateCancels: 1 }), 60);
  assert.equal(computeTrust({ ...base, completedRides: 5, unresolvedReports: 1 }), 50);
});
test('score is clamped to 0..100', () => {
  assert.equal(computeTrust({ ...base, unresolvedReports: 9 }), 0);
  assert.equal(computeTrust({ ...base, completedRides: 9, ratingSum: 50, ratingCount: 10, punctualCount: 20, adminAdjust: 50 }), 100);
});
test('seeded demo accounts hit the documented scores (96 / 92 / 64)', () => {
  // Ananya: 6 rides, avg 4.5, 5 punctual
  assert.equal(computeTrust({ ...base, completedRides: 6, ratingSum: 27, ratingCount: 6, punctualCount: 5 }), 96);
  // Rohan: 5 rides, avg 4.2, 4 punctual
  assert.equal(computeTrust({ ...base, completedRides: 5, ratingSum: 21, ratingCount: 5, punctualCount: 4 }), 92);
  // Kabir: 5 rides, avg 3.6, 2 punctual, 2 recent cancellations (1 late)
  assert.equal(computeTrust({ ...base, completedRides: 5, ratingSum: 18, ratingCount: 5, punctualCount: 2, cancelCount: 2, lateCancels: 1 }), 64);
});
test('breakdown components sum to total', () => {
  const b = trustBreakdown({ ...base, completedRides: 3, ratingSum: 20, ratingCount: 5, punctualCount: 2, cancelCount: 1, lateCancels: 1, adminAdjust: -TRUST.ADMIN_PENALTY });
  assert.equal(b.base + b.rides + b.rating + b.punctuality - b.lateCancelPenalty - b.cancelPenalty - b.reportPenalty + b.adminAdjust, b.total);
});
