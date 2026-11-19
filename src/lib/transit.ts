// Train / flight number normalisation. (Schedules are NOT hard-coded: students enter the departure time themselves.)
export const TRAIN_RE = /^\d{5}$/;
export const FLIGHT_RE = /^[A-Z0-9]{2}-?\d{2,4}$/;

export function normalizeTransit(raw: string): { kind: 'TRAIN' | 'FLIGHT'; number: string } | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (TRAIN_RE.test(s)) return { kind: 'TRAIN', number: s };
  if (FLIGHT_RE.test(s)) {
    const m = s.match(/^([A-Z0-9]{2})-?(\d{2,4})$/)!;
    return { kind: 'FLIGHT', number: `${m[1]}-${m[2]}` };
  }
  return null;
}
