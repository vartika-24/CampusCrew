import { db } from '@/lib/db';
import { handle, ok, readJsonOpt } from '@/lib/api';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  return ok({ notifications: items.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })), unread: items.filter((n) => !n.read).length });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJsonOpt(req);
  await db.notification.updateMany({ where: { userId: user.id, read: false, ...(typeof body.id === 'string' ? { id: body.id } : {}) }, data: { read: true } });
  return ok({ ok: true });
});
