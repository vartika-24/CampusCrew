import test from 'node:test';
import assert from 'node:assert/strict';
import { splitFare, upiLink } from '../src/lib/fare';

test('₹1,200 across 4 riders + ₹5 fee = ₹305 each', () => {
  const s = splitFare(1200, 4);
  assert.deepEqual([s.baseShare, s.fee, s.perRider], [300, 5, 305]);
});
test('uneven splits round up so the driver is always fully paid', () => {
  const s = splitFare(1000, 3);
  assert.equal(s.baseShare, 334);
  assert.ok(s.collected >= 1000 + 3 * 5);
});
test('single rider pays the whole fare + fee', () => assert.equal(splitFare(400, 1).perRider, 405));
test('rejects negative fares', () => assert.throws(() => splitFare(-1, 2)));
test('UPI deep-link carries payee, amount and note', () => {
  const u = upiLink({ pa: 'rohan@oksbi', pn: 'Rohan Verma', amount: 305 });
  assert.ok(u.startsWith('upi://pay?'));
  const q = new URL(u.replace('upi://', 'http://x/')).searchParams;
  assert.equal(q.get('pa'), 'rohan@oksbi');
  assert.equal(q.get('am'), '305');
  assert.equal(q.get('tn'), 'CampusCrew');
  assert.equal(q.get('cu'), 'INR');
});
