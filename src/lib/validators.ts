import { allowedDomains, isAdminEmail } from './config';

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Registration is limited to configured college domains (default: iiita.ac.in and its subdomains) or bootstrap admin emails. */
export function isCollegeEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split('@')[1];
  return allowedDomains().some((d) => domain === d || domain.endsWith(`.${d}`)) || isAdminEmail(email);
}

export function yearFromRoll(roll: string, now = new Date()): number {
  const batch = Number(roll.slice(3, 7));
  const y = now.getFullYear() - batch + (now.getMonth() >= 6 ? 1 : 0);
  return Math.max(1, Math.min(5, y));
}
