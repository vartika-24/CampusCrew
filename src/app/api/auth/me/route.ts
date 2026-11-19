import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { getSessionUser, isDemoMode, publicUser } from '@/lib/auth';
import { outstandingDues } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const u = await getSessionUser();
  if (!u || u.suspended) return ok({ user: null, demoMode: isDemoMode() });
  const [dues, unread] = await Promise.all([outstandingDues(u.id), db.notification.count({ where: { userId: u.id, read: false } })]);
  return ok({ user: publicUser(u), dues, unread, demoMode: isDemoMode() });
});
