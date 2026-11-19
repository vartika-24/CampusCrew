// Date / time helpers. Dates are plain "YYYY-MM-DD" strings, times "HH:MM" (campus local time, IST).
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export function isNightTime(t: string, nightStart = '21:00', nightEnd = '05:00'): boolean {
  const m = toMinutes(t);
  return m >= toMinutes(nightStart) || m < toMinutes(nightEnd);
}

/** Minutes of overlap between two same-day windows (0 if disjoint). */
export function overlapMinutes(aS: string, aE: string, bS: string, bE: string): number {
  const s = Math.max(toMinutes(aS), toMinutes(bS));
  const e = Math.min(toMinutes(aE), toMinutes(bE));
  return Math.max(0, e - s);
}

/** Gap in minutes between two disjoint windows (0 when overlapping). */
export function gapMinutes(aS: string, aE: string, bS: string, bE: string): number {
  if (overlapMinutes(aS, aE, bS, bE) > 0) return 0;
  const aStart = toMinutes(aS), aEnd = toMinutes(aE), bStart = toMinutes(bS), bEnd = toMinutes(bE);
  return aEnd <= bStart ? bStart - aEnd : aStart - bEnd;
}

/** Parse YYYY-MM-DD + HH:MM as IST (+05:30) instant. */
export function istInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+05:30`);
}

const IST_OFFSET_MS = 5.5 * 3600 * 1000;

/** Today's date (IST) as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function hoursUntil(date: string, time: string, now = new Date()): number {
  return (istInstant(date, time).getTime() - now.getTime()) / 3600000;
}

export function formatDateLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
