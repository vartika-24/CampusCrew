import { db } from './db';
import { addDays, eachDate, todayIST } from './time';

export type SurgeCell = { date: string; hour: number; count: number; multiplier: number };

import { getSettings } from './settings';
export { getSettings };

/** Below this many students in an hour there is not enough signal to call a surge. */
export const MIN_SURGE_SIGNAL = 10;

/** Surge multiplier from demand relative to the normal-evening baseline (log-damped, 1.0–3.0×). */
export function surgeMultiplier(count: number, baseline: number): number {
  if (baseline <= 0 || count < MIN_SURGE_SIGNAL) return 1;
  const ratio = Math.max(1, count / baseline);
  return Math.min(3, Math.round((1 + 0.5 * Math.log2(ratio)) * 10) / 10);
}

export async function demandCells(from: string, to: string, destIds?: string[]) {
  const [snaps, live] = await Promise.all([
    db.demandSnapshot.findMany({ where: { date: { gte: from, lte: to }, ...(destIds ? { destId: { in: destIds } } : {}) } }),
    db.tripSegment.findMany({
      where: { date: { gte: from, lte: to }, status: { in: ['PLANNED', 'MATCHED', 'WAITLISTED'] }, ...(destIds ? { destId: { in: destIds } } : {}) },
      select: { date: true, windowStart: true, destId: true },
    }),
  ]);
  const map = new Map<string, { date: string; hour: number; destId: string; count: number }>();
  const bump = (date: string, hour: number, destId: string, n: number) => {
    const k = `${date}|${hour}|${destId}`;
    const e = map.get(k) ?? { date, hour, destId, count: 0 };
    e.count += n;
    map.set(k, e);
  };
  for (const s of snaps) bump(s.date, s.hour, s.destId, s.count);
  for (const l of live) bump(l.date, Number(l.windowStart.slice(0, 2)), l.destId, 1); // live trip intents add to the index
  return [...map.values()];
}

export async function surgeOverview() {
  const settings = await getSettings();
  const today = todayIST();
  const from = addDays(today, -2);
  const to = addDays(today, 7);
  const dates = eachDate(from, to);
  const cells = await demandCells(from, to);
  const byCell = new Map<string, number>();
  for (const c of cells) byCell.set(`${c.date}|${c.hour}`, (byCell.get(`${c.date}|${c.hour}`) ?? 0) + c.count);

  const breakStart = settings.breakStart || addDays(today, 1);
  const breakEnd = settings.breakEnd || addDays(today, 4);
  // Baseline = typical evening (15:00-19:59) demand on ordinary, non-break days.
  const normal: number[] = [];
  for (const d of dates) {
    if (d >= breakStart && d <= breakEnd) continue;
    for (let h = 15; h <= 19; h++) normal.push(byCell.get(`${d}|${h}`) ?? 0);
  }
  let baseline = normal.length ? normal.reduce((a, b) => a + b, 0) / normal.length : 0;
  if (baseline <= 0) { const nz = [...byCell.values()].filter((v) => v > 0); baseline = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : 1; }

  const heat: SurgeCell[] = [];
  for (const d of dates) for (let h = 5; h <= 23; h++) {
    const count = byCell.get(`${d}|${h}`) ?? 0;
    heat.push({ date: d, hour: h, count, multiplier: surgeMultiplier(count, baseline) });
  }
  const days = dates.map((date) => {
    const hs = heat.filter((c) => c.date === date);
    const peak = hs.reduce((a, b) => (b.count > a.count ? b : a));
    return { date, total: hs.reduce((s, c) => s + c.count, 0), peakHour: peak.hour, peakMultiplier: peak.multiplier, inBreak: date >= breakStart && date <= breakEnd };
  });
  const peak = heat.filter((c) => c.date >= today).reduce((a, b) => (b.count > a.count ? b : a));
  const hasData = peak.count >= MIN_SURGE_SIGNAL;
  return { today, hasData, configured: !!settings.breakStart, breakStart, breakEnd, breakLabel: settings.breakLabel ?? 'Vacation window', baseline: Math.round(baseline), heat, days, peak, lockSavingPct: Math.round((1 - 1 / peak.multiplier) * 100) };
}
