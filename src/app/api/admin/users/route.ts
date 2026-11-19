import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const users = await db.user.findMany({ where: { role: 'STUDENT' }, orderBy: { trustScore: 'asc' }, take: 100 });
  return ok({
    users: users.map((u) => ({
      id: u.id, name: u.name, email: u.email, department: u.department, hostel: u.hostel, gender: u.gender, trustScore: u.trustScore, completedRides: u.completedRides,
      cancelCount: u.cancelCount, lateCancels: u.lateCancels, suspended: u.suspended, idCardStatus: u.idCardStatus,
    })),
  });
});
