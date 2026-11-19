import { db } from './db';
import { placesMap } from './matching/engine';
import { surgeMultiplier, demandCells, getSettings } from './surge';
import { addDays, eachDate, todayIST } from './time';

export async function alertsDTO(statuses: string[] = ['ACTIVE']) {
  const [rows, places] = await Promise.all([
    db.emergencyAlert.findMany({
      where: { status: { in: statuses } }, orderBy: { createdAt: 'desc' }, take: 40,
      include: { user: true, group: { include: { operator: true, members: { where: { status: 'JOINED' }, include: { user: true } } } } },
    }),
    placesMap(),
  ]);
  return rows.map((a) => ({
    id: a.id, status: a.status, lat: a.lat, lng: a.lng, note: a.note, createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null, resolvedNote: a.resolvedNote,
    rider: { id: a.user.id, name: a.user.name, hostel: a.user.hostel, department: a.user.department, trustScore: a.user.trustScore },
    trip: {
      id: a.groupId, route: `${places.get(a.group.originId)?.name ?? ''} → ${places.get(a.group.destId)?.name ?? ''}`, mode: a.group.mode, status: a.group.status,
      plate: a.group.operator?.plate ?? null, driver: a.group.operator?.name ?? null, riders: a.group.members.map((m) => m.user.name.split(' ')[0]),
    },
  }));
}

export async function reportsDTO() {
  const rows = await db.report.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 60,
    include: { reporter: true, target: true, group: true },
  });
  const places = await placesMap();
  rows.sort((a, b) => Number(b.status === 'OPEN') - Number(a.status === 'OPEN') || b.createdAt.getTime() - a.createdAt.getTime());
  return rows.map((r) => ({
    id: r.id, type: r.type, status: r.status, description: r.description, resolution: r.resolution, createdAt: r.createdAt.toISOString(),
    reporter: { id: r.reporter.id, name: r.reporter.name },
    target: r.target ? { id: r.target.id, name: r.target.name, trustScore: r.target.trustScore, suspended: r.target.suspended, hostel: r.target.hostel } : null,
    trip: r.group ? `${places.get(r.group.originId)?.name.split(' (')[0] ?? ''} → ${places.get(r.group.destId)?.name.split(' (')[0] ?? ''} · ${r.group.date}` : null,
  }));
}

/** Hourly student demand toward Prayagraj Junction & Airport + shuttle-bus recommendation. */
export async function demandPlan(date: string) {
  const [pryj, ixd, settings] = await Promise.all([
    db.place.findUnique({ where: { code: 'PRYJ' } }), db.place.findUnique({ where: { code: 'IXD' } }), getSettings(),
  ]);
  const today = todayIST();
  const from = addDays(today, -2), to = addDays(today, 7);
  const all = await demandCells(from, to);
  const hourTotal = new Map<string, number>();
  for (const c of all) hourTotal.set(`${c.date}|${c.hour}`, (hourTotal.get(`${c.date}|${c.hour}`) ?? 0) + c.count);
  const bStart = settings.breakStart ?? addDays(today, 1), bEnd = settings.breakEnd ?? addDays(today, 4);
  const normal: number[] = [];
  for (const d of eachDate(from, to)) if (d < bStart || d > bEnd) for (let h = 15; h <= 19; h++) normal.push(hourTotal.get(`${d}|${h}`) ?? 0);
  const baseline = normal.length ? normal.reduce((a, b) => a + b, 0) / normal.length : 1;

  const SHUTTLE_SEATS = 40;
  const SHUTTLE_SHARE = 0.55; // share of intents an institute shuttle can realistically absorb
  const hours = [];
  for (let h = 5; h <= 23; h++) {
    const p = all.filter((c) => c.date === date && c.hour === h && c.destId === pryj?.id).reduce((s, c) => s + c.count, 0);
    const a = all.filter((c) => c.date === date && c.hour === h && c.destId === ixd?.id).reduce((s, c) => s + c.count, 0);
    const demand = p + a;
    hours.push({ hour: h, label: `${String(h).padStart(2, '0')}:00`, junction: p, airport: a, total: demand, multiplier: surgeMultiplier(hourTotal.get(`${date}|${h}`) ?? 0, baseline), buses: Math.ceil((demand * SHUTTLE_SHARE) / SHUTTLE_SEATS) });
  }
  const plan = hours.filter((h) => h.buses > 0 && h.total >= 20).map((h) => ({
    time: h.label, to: h.junction >= h.airport * 2 ? 'Prayagraj Junction' : 'Prayagraj Junction + Airport', buses: h.buses, students: Math.round(h.total * SHUTTLE_SHARE),
  }));
  return { date, hours, plan, shuttleSeats: SHUTTLE_SEATS, totalBuses: plan.reduce((s, p) => s + p.buses, 0), totalStudents: hours.reduce((s, h) => s + h.total, 0), dates: eachDate(bStart, addDays(bEnd, 1)), breakStart: bStart, breakEnd: bEnd };
}
