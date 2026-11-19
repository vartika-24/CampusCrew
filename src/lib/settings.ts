import { db } from './db';

export const DEFAULT_HELPLINES = [
  { label: 'Police Emergency', number: '112' },
  { label: 'Women Helpline', number: '1091' },
  { label: 'Ambulance', number: '108' },
];

// Starting lists — editable by admins (Settings tab). Confirm them for your campus before launch.
export const DEFAULT_HOSTELS = ['BH-1', 'BH-2', 'BH-3', 'BH-4', 'BH-5', 'GH-1', 'GH-2', 'GH-3', 'Day Scholar'];
export const DEFAULT_DEPARTMENTS = ['B.Tech ECE', 'B.Tech IT', 'B.Tech CSE', 'B.Tech ITBI', 'M.Tech', 'MBA', 'Ph.D'];

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function parseList<T>(raw: string | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try { const v = JSON.parse(raw); return Array.isArray(v) && v.length ? v : fallback; } catch { return fallback; }
}

export type Helpline = { label: string; number: string };

export async function getConfig() {
  const s = await getSettings();
  return {
    raw: s,
    campusName: s.campusName || 'IIIT Allahabad',
    helplines: parseList<Helpline>(s.helplines, DEFAULT_HELPLINES),
    hostels: parseList<string>(s.hostels, DEFAULT_HOSTELS),
    departments: parseList<string>(s.departments, DEFAULT_DEPARTMENTS),
    shuttleSeats: Math.max(10, Math.min(100, Number(s.shuttleSeats) || 40)),
    breakStart: s.breakStart || null,
    breakEnd: s.breakEnd || null,
    breakLabel: s.breakLabel || 'Vacation window',
    returnDate: s.returnDate || null,
  };
}

export async function setSetting(key: string, value: string | null) {
  if (value === null || value === '') await db.setting.deleteMany({ where: { key } });
  else await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** Production bootstrap: only neutral defaults, no sample data. */
export async function ensureDefaultSettings() {
  const s = await getSettings();
  const defaults: Record<string, string> = {
    campusName: 'IIIT Allahabad', helplines: JSON.stringify(DEFAULT_HELPLINES), hostels: JSON.stringify(DEFAULT_HOSTELS),
    departments: JSON.stringify(DEFAULT_DEPARTMENTS), shuttleSeats: '40',
  };
  for (const [k, v] of Object.entries(defaults)) if (!(k in s)) await setSetting(k, v);
}
