import { db } from './db';
import { EMISSION_KG_PER_KM, roadKm } from './geo';
import { placesMap } from './matching/engine';

export type EcoRow = { groupId: string; date: string; userId: string; name: string; hostel: string | null; saved: number; co2: number; cabsEliminated: number; shared: boolean };

/** Per-rider eco & savings facts for every completed shared trip with a recorded fare. */
export async function ecoRows(): Promise<EcoRow[]> {
  const [groups, places] = await Promise.all([
    db.tripGroup.findMany({
      where: { status: 'COMPLETED' },
      include: { members: { where: { status: 'JOINED', boarded: true }, include: { user: true } } },
    }),
    placesMap(),
  ]);
  const rows: EcoRow[] = [];
  for (const g of groups) {
    const n = g.members.length;
    if (n === 0) continue;
    const o = places.get(g.originId), d = places.get(g.destId);
    if (!o || !d) continue;
    const km = roadKm(o, d);
    const factor = EMISSION_KG_PER_KM[g.mode] ?? 0;
    const sharedVehicle = g.mode === 'CAB' || g.mode === 'AUTO';
    // Each rider avoids a solo vehicle: saves fare - (fare/n); CO2 of (n-1) vehicles is split among riders.
    const solo = g.fareTotal ?? 0;
    const share = n > 0 ? Math.ceil(solo / n) : 0;
    for (const m of g.members) {
      rows.push({
        groupId: g.id, date: g.date, userId: m.userId, name: m.user.name, hostel: m.user.hostel,
        saved: sharedVehicle && n > 1 ? Math.max(0, solo - share) : 0,
        co2: sharedVehicle && n > 1 ? (km * factor * (n - 1)) / n : 0,
        cabsEliminated: sharedVehicle && n > 1 ? (n - 1) / n : 0,
        shared: sharedVehicle && n > 1,
      });
    }
  }
  return rows;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export async function ecoSummary(userId?: string) {
  const rows = await ecoRows();
  const sum = (rs: EcoRow[]) => ({
    moneySaved: Math.round(rs.reduce((s, r) => s + r.saved, 0)),
    cabsEliminated: Math.round(rs.reduce((s, r) => s + r.cabsEliminated, 0)),
    co2Kg: r1(rs.reduce((s, r) => s + r.co2, 0)),
    trips: new Set(rs.filter((r) => r.shared).map((r) => r.groupId)).size,
  });
  const campus = sum(rows);
  const mine = userId ? sum(rows.filter((r) => r.userId === userId)) : null;

  const byHostel = new Map<string, EcoRow[]>();
  const byUser = new Map<string, EcoRow[]>();
  for (const r of rows) {
    const h = r.hostel ?? 'Day Scholar';
    byHostel.set(h, [...(byHostel.get(h) ?? []), r]);
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  }
  const hostels = [...byHostel.entries()]
    .map(([hostel, rs]) => ({ hostel, ...sum(rs) }))
    .sort((a, b) => b.co2Kg - a.co2Kg);
  const students = [...byUser.entries()]
    .map(([id, rs]) => ({ userId: id, name: rs[0].name.split(' ')[0] + ' ' + (rs[0].name.split(' ')[1]?.[0] ?? '') + '.', hostel: rs[0].hostel, ...sum(rs) }))
    .sort((a, b) => b.co2Kg - a.co2Kg)
    .slice(0, 10);

  // cumulative savings by date for the trend chart
  const perDay = new Map<string, number>();
  for (const r of userId ? rows.filter((x) => x.userId === userId) : rows) perDay.set(r.date, (perDay.get(r.date) ?? 0) + r.saved);
  let cum = 0;
  const trend = [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, saved: (cum += v) }));
  return { campus, mine, hostels, students, trend };
}
