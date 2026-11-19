import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPrefsFor, genderAllowed, genderWhere } from '../src/lib/safety/gender';

test('girls-only trips are visible to female users only', () => {
  assert.equal(genderAllowed('FEMALE', 'GIRLS_ONLY'), true);
  assert.equal(genderAllowed('MALE', 'GIRLS_ONLY'), false);
  assert.equal(genderAllowed('OTHER', 'GIRLS_ONLY'), false);
});
test('boys-only trips are visible to male users only', () => {
  assert.equal(genderAllowed('MALE', 'BOYS_ONLY'), true);
  assert.equal(genderAllowed('FEMALE', 'BOYS_ONLY'), false);
});
test('mixed trips are visible to everyone', () => {
  for (const g of ['FEMALE', 'MALE', 'OTHER', 'unknown']) assert.equal(genderAllowed(g, 'MIXED'), true);
});
test('prisma where-fragment never includes the opposite gendered preference', () => {
  assert.deepEqual(genderWhere('MALE').genderPref.in.sort(), ['BOYS_ONLY', 'MIXED']);
  assert.deepEqual(genderWhere('FEMALE').genderPref.in.sort(), ['GIRLS_ONLY', 'MIXED']);
  assert.deepEqual(allowedPrefsFor('OTHER'), ['MIXED']);
});
