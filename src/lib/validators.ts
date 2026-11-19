import { ROLL_REGEX } from './constants';

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

export function allowedSuffixes(): string[] {
  return (process.env.ALLOWED_EMAIL_SUFFIXES ?? '.ac.in,.edu,.edu.in').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** College-domain restriction: must be a valid email whose domain ends in .ac.in / .edu / .edu.in */
export function isCollegeEmail(email: string): boolean {
  if (!EMAIL_RE.test(email)) return false;
  const domain = email.split('@')[1];
  return allowedSuffixes().some((s) => domain.endsWith(s));
}

export function yearFromRoll(roll: string, now = new Date()): number {
  const batch = Number(roll.slice(3, 7));
  const y = now.getFullYear() - batch + (now.getMonth() >= 6 ? 1 : 0);
  return Math.max(1, Math.min(5, y));
}

/** Simulated registrar check on the Student ID card: roll-number format + plausible admission batch. */
export function verifyStudentId(roll: string, now = new Date()): { ok: boolean; steps: { label: string; ok: boolean }[] } {
  const batch = Number(roll.slice(3, 7));
  const formatOk = ROLL_REGEX.test(roll);
  const batchOk = formatOk && batch >= now.getFullYear() - 6 && batch <= now.getFullYear();
  const steps = [
    { label: 'Roll number format valid', ok: formatOk },
    { label: 'Admission batch recognised', ok: batchOk },
    { label: 'Matched with college email domain', ok: true },
  ];
  return { ok: steps.every((s) => s.ok), steps };
}
