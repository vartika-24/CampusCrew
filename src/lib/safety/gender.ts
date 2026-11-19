import type { Gender, GenderPref } from '../constants';

/** Which group gender-preferences a user is allowed to see / join. */
export function allowedPrefsFor(gender: string): GenderPref[] {
  if (gender === 'FEMALE') return ['MIXED', 'GIRLS_ONLY'];
  if (gender === 'MALE') return ['MIXED', 'BOYS_ONLY'];
  return ['MIXED']; // OTHER / unknown: mixed-only
}

/** Hard gender filter. Use for every query returning groups/segments to a user. */
export function genderAllowed(userGender: string, pref: string): boolean {
  return (allowedPrefsFor(userGender) as string[]).includes(pref);
}

/** Prisma `where` fragment for TripGroup / TripSegment (both have `genderPref`). */
export function genderWhere(userGender: string): { genderPref: { in: string[] } } {
  return { genderPref: { in: allowedPrefsFor(userGender) } };
}

/** Can this user create a trip with the given preference? */
export function canCreateWithPref(userGender: Gender | string, pref: string): boolean {
  return genderAllowed(userGender, pref);
}

/**
 * Gender used for visibility decisions. Until an admin has verified the government ID,
 * the self-declared gender is NOT trusted: unverified users only ever see MIXED crews.
 */
export function effectiveGender(u: { gender: string; idCardStatus: string; role?: string }): string {
  return u.idCardStatus === 'VERIFIED' ? u.gender : 'OTHER';
}
