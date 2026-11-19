import test from 'node:test';
import assert from 'node:assert/strict';
import { isCollegeEmail, verifyStudentId, yearFromRoll } from '../src/lib/validators';
import { buildRoute, haversineKm, polylineLength, positionAt, roadKm } from '../src/lib/geo';
import { addDays, fromMinutes, isNightTime, overlapMinutes, toMinutes } from '../src/lib/time';
import { normalizeTransit } from '../src/lib/transit';

test('college email domain restriction', () => {
  assert.equal(isCollegeEmail('student.female@iiita.ac.in'), true);
  assert.equal(isCollegeEmail('a@mit.edu'), true);
  assert.equal(isCollegeEmail('a@gmail.com'), false);
  assert.equal(isCollegeEmail('not-an-email'), false);
});
test('student ID verification & academic year', () => {
  assert.equal(verifyStudentId('IEC2024123', new Date('2026-11-19')).ok, true);
  assert.equal(verifyStudentId('IEC1999123', new Date('2026-11-19')).ok, false);
  assert.equal(verifyStudentId('BAD', new Date('2026-11-19')).ok, false);
  assert.equal(yearFromRoll('IEC2024123', new Date('2026-11-19')), 3);
});
test('time helpers', () => {
  assert.equal(toMinutes('16:30'), 990);
  assert.equal(fromMinutes(990), '16:30');
  assert.equal(overlapMinutes('16:00', '17:30', '17:00', '18:00'), 30);
  assert.equal(isNightTime('21:00'), true);
  assert.equal(isNightTime('04:59'), true);
  assert.equal(isNightTime('05:00'), false);
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
});
test('geo: distances and route interpolation', () => {
  const a = { lat: 25.4285, lng: 81.7712 }, b = { lat: 25.4464, lng: 81.8301 };
  assert.ok(haversineKm(a, b) > 5 && haversineKm(a, b) < 8);
  assert.ok(roadKm(a, b) > haversineKm(a, b));
  const r = buildRoute(a, b, 'seed');
  assert.deepEqual(r[0], a);
  assert.deepEqual(r[r.length - 1], b);
  assert.deepEqual(positionAt(r, 0), a);
  assert.deepEqual(positionAt(r, 1), b);
  assert.ok(polylineLength(r) >= haversineKm(a, b));
  assert.deepEqual(buildRoute(a, b, 'seed'), r); // deterministic
});
test('train / flight number normalisation', () => {
  assert.deepEqual(normalizeTransit(' 12301 '), { kind: 'TRAIN', number: '12301' });
  assert.deepEqual(normalizeTransit('6e2134'), { kind: 'FLIGHT', number: '6E-2134' });
  assert.equal(normalizeTransit('abc'), null);
});
