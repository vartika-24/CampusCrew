// Central runtime configuration (all from environment variables).

/** Demo mode seeds sample accounts/data and enables one-click demo login + simulated tracking. NEVER enable in production. */
export const isDemoMode = () => process.env.DEMO_MODE === 'true';

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? 'iiita.ac.in').split(',').map((s) => s.trim().toLowerCase().replace(/^[.@]/, '')).filter(Boolean);
}

/** Emails that become Student-Affairs admins on first sign-in (bootstrap only). */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export const isAdminEmail = (email: string) => adminEmails().includes(email.toLowerCase());

/**
 * Sign-in mode.
 *  - "otp":     a one-time code is emailed (needs an email provider)            <- secure default
 *  - "instant": typing a college email signs you in directly (no code, no inbox check).
 *               Fine for demos/pilots; anyone who knows a classmate's email could sign in as them.
 *               Admin emails are never allowed through this path.
 */
export const authMode = (): 'otp' | 'instant' => (process.env.AUTH_MODE === 'instant' ? 'instant' : 'otp');

/** When false, signup skips the government-ID photo and the student declares their gender (locked afterwards). */
export const requireGovId = () => process.env.REQUIRE_GOV_ID !== 'false';

/** Adds the IIITA pickup points / hubs from the project brief on first boot when there are no places yet. */
export const loadStarterPlaces = () => process.env.LOAD_STARTER_PLACES !== 'false';

/** Test-only: return the OTP in the API response. Never set in real deployments. */
export const exposeDevOtp = () => process.env.EXPOSE_DEV_OTP === 'true';
