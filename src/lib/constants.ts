export const MODES = ['CAB', 'AUTO', 'BUS', 'TRAIN', 'FLIGHT'] as const;
export type Mode = (typeof MODES)[number];

export const GENDERS = ['FEMALE', 'MALE', 'OTHER'] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_PREFS = ['MIXED', 'GIRLS_ONLY', 'BOYS_ONLY'] as const;
export type GenderPref = (typeof GENDER_PREFS)[number];

export const VEHICLE_TYPES = ['SEDAN4', 'SUV6', 'AUTO', 'SHARED'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_SPECS: Record<VehicleType, { label: string; seats: number; bags: number }> = {
  SEDAN4: { label: '4-seater sedan', seats: 4, bags: 4 },
  SUV6: { label: '6-seater SUV', seats: 6, bags: 6 },
  AUTO: { label: 'Auto-rickshaw', seats: 3, bags: 3 },
  SHARED: { label: 'Shared / public transport', seats: 6, bags: 99 },
};

export const MODE_LABEL: Record<Mode, string> = {
  CAB: 'Cab',
  AUTO: 'Auto',
  BUS: 'Bus',
  TRAIN: 'Train',
  FLIGHT: 'Flight',
};

export const GENDER_PREF_LABEL: Record<GenderPref, string> = {
  MIXED: 'Mixed',
  GIRLS_ONLY: 'Girls only',
  BOYS_ONLY: 'Boys only',
};

export const MAX_LUGGAGE = 3;
export const PLATFORM_FEE = 5; // ₹ per rider
export const TRUST_MIN_NIGHT = 70; // trust below this: deprioritised + no late-night rides
export const NIGHT_START = '21:00';
export const NIGHT_END = '05:00';
export const LATE_CANCEL_HOURS = 3;

export const SESSION_COOKIE = 'cc_session';

export const REPORT_TYPES = ['GENDER_MISMATCH', 'DISPUTE', 'HARASSMENT', 'NO_SHOW', 'OTHER'] as const;
export const REPORT_TYPE_LABEL: Record<string, string> = {
  GENDER_MISMATCH: 'Gender / identity mismatch',
  DISPUTE: 'Rider dispute',
  HARASSMENT: 'Harassment / unsafe behaviour',
  NO_SHOW: 'No-show',
  OTHER: 'Other',
};

export const ROLL_REGEX = /^[A-Z]{3}\d{7}$/;
