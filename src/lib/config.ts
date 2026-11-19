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
