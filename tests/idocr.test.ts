import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGender, looksLikeIdType, nameOnId } from '../src/lib/idocr';

test('reads gender printed on Aadhaar / voter ID text', () => {
  assert.equal(extractGender('Priya Nair\nDOB: 12/03/2003\nFemale\n1234 5678 9012').gender, 'FEMALE');
  assert.equal(extractGender('Rahul Verma\nDOB 01/01/2002\nMALE').gender, 'MALE');
  assert.equal(extractGender('Sex / Gender: FEMALE').gender, 'FEMALE');
  assert.equal(extractGender('Gender: Transgender').gender, 'OTHER');
});
test('"FEMALE" is never mistaken for MALE', () => assert.equal(extractGender('FEMALE only').gender, 'FEMALE'));
test('tolerates common OCR slips', () => assert.equal(extractGender('Fernale').gender, 'FEMALE'));
test('passport style sex field and MRZ', () => {
  assert.equal(extractGender('Sex F Date of birth 01 JAN 2001').gender, 'FEMALE');
  assert.equal(extractGender('Sex: M').gender, 'MALE');
  assert.equal(extractGender('P<INDNAIR<<PRIYA<<<<<<\nK1234567<8IND0303125F2801013<<<<<<<<<<<<<<04').gender, 'FEMALE');
});
test('conflicting or missing gender yields null', () => {
  assert.deepEqual(extractGender('Male Female'), { gender: null, ambiguous: true });
  assert.deepEqual(extractGender('Government of India nothing else'), { gender: null, ambiguous: false });
});
test('ID type keywords', () => {
  assert.equal(looksLikeIdType('GOVERNMENT OF INDIA Aadhaar', 'AADHAAR'), true);
  assert.equal(looksLikeIdType('1234 5678 9012', 'AADHAAR'), true);
  assert.equal(looksLikeIdType('Republic of India Passport', 'PASSPORT'), true);
  assert.equal(looksLikeIdType('Government of India', 'PASSPORT'), false);
  assert.equal(looksLikeIdType('Election Commission of India', 'VOTER_ID'), true);
  assert.equal(looksLikeIdType('Driving Licence', 'DRIVING_LICENCE'), true);
});
test('name check tolerates one OCR typo but not a different person', () => {
  assert.equal(nameOnId('Priya Nair', 'Name: PRIYA NAIR'), true);
  assert.equal(nameOnId('Priya Nair', 'Name: PRlYA NAIR'), true);
  assert.equal(nameOnId('Rahul Verma', 'Name: PRIYA NAIR'), false);
  assert.equal(nameOnId('A B', 'anything'), false);
});
