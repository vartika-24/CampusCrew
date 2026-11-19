import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { ecoSummary } from '@/lib/eco';
import { todayIST } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const today = todayIST();
  const pendingIds = await db.user.count({ where: { role: 'STUDENT', idCardStatus: 'PENDING', idDocuments: { some: {} } } });
  const [students, verified, suspended, openTrips, liveTrips, completed, todays, activeSos, openReports, lowTrust, eco] = await Promise.all([
    db.user.count({ where: { role: 'STUDENT' } }), db.user.count({ where: { role: 'STUDENT', idCardStatus: 'VERIFIED' } }), db.user.count({ where: { suspended: true } }),
    db.tripGroup.count({ where: { status: { in: ['OPEN', 'CONFIRMED'] }, date: { gte: today } } }), db.tripGroup.count({ where: { status: 'IN_PROGRESS' } }),
    db.tripGroup.count({ where: { status: 'COMPLETED' } }), db.tripGroup.count({ where: { date: today, status: { not: 'CANCELLED' } } }),
    db.emergencyAlert.count({ where: { status: 'ACTIVE' } }), db.report.count({ where: { status: 'OPEN' } }), db.user.count({ where: { role: 'STUDENT', trustScore: { lt: 70 } } }),
    ecoSummary(),
  ]);
  return ok({ pendingIds, students, verified, suspended, openTrips, liveTrips, completed, todaysTrips: todays, activeSos, openReports, lowTrust, eco: eco.campus, hostels: eco.hostels });
});
