// Trust Score engine (0-100). Pure function so it is trivially testable.
export type TrustInput = {
  verified: boolean; // student ID + college email verified
  completedRides: number;
  ratingSum: number; // sum of 1-5 peer ratings
  ratingCount: number;
  punctualCount: number; // times peers confirmed punctuality
  cancelCount: number; // all recent cancellations (includes late ones)
  lateCancels: number; // last-minute cancellations
  unresolvedReports: number; // open reports against the user
  adminAdjust: number; // moderation adjustments (negative = penalty)
};

export const TRUST = {
  BASE_VERIFIED: 50,
  PER_RIDE: 5,
  RIDES_CAP: 25,
  RATING_MAX: 15,
  PUNCTUAL_PER: 2,
  PUNCTUAL_CAP: 10,
  LATE_CANCEL_PENALTY: 15,
  REGULAR_CANCEL_PENALTY: 5,
  UNRESOLVED_REPORT_PENALTY: 25,
  ADMIN_PENALTY: 10,
} as const;

export type TrustBreakdown = {
  base: number; rides: number; rating: number; punctuality: number;
  lateCancelPenalty: number; cancelPenalty: number; reportPenalty: number; adminAdjust: number; total: number;
};

export function trustBreakdown(i: TrustInput): TrustBreakdown {
  const base = i.verified ? TRUST.BASE_VERIFIED : 0;
  const rides = Math.min(TRUST.RIDES_CAP, i.completedRides * TRUST.PER_RIDE);
  // average rating 3.0 -> 0, 5.0 -> +15, 1.0 -> -15 (integer math avoids float drift)
  const rating = i.ratingCount > 0
    ? Math.round((((i.ratingSum * 10) / i.ratingCount - 30) * TRUST.RATING_MAX) / 20)
    : 0;
  const punctuality = Math.min(TRUST.PUNCTUAL_CAP, i.punctualCount * TRUST.PUNCTUAL_PER);
  const lateCancelPenalty = i.lateCancels * TRUST.LATE_CANCEL_PENALTY;
  const cancelPenalty = Math.max(0, i.cancelCount - i.lateCancels) * TRUST.REGULAR_CANCEL_PENALTY;
  const reportPenalty = i.unresolvedReports * TRUST.UNRESOLVED_REPORT_PENALTY;
  const raw = base + rides + rating + punctuality - lateCancelPenalty - cancelPenalty - reportPenalty + i.adminAdjust;
  const total = Math.max(0, Math.min(100, raw));
  return { base, rides, rating, punctuality, lateCancelPenalty, cancelPenalty, reportPenalty, adminAdjust: i.adminAdjust, total };
}

export function computeTrust(i: TrustInput): number {
  return trustBreakdown(i).total;
}

export function trustTier(score: number): { label: string; tone: 'green' | 'amber' | 'red' } {
  if (score >= 85) return { label: 'Excellent', tone: 'green' };
  if (score >= 70) return { label: 'Good', tone: 'green' };
  if (score >= 50) return { label: 'Needs improvement', tone: 'amber' };
  return { label: 'Restricted', tone: 'red' };
}
