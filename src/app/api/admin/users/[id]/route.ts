import { db } from '@/lib/db';
import { handle, notFound, ok, oneOf, readJson, str } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { leaveGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body.action, 'action', ['suspend', 'unsuspend'] as const);
  const u = await db.user.findUnique({ where: { id: params.id } });
  if (!u || u.role === 'ADMIN') throw notFound('Student not found');
  if (action === 'suspend') {
    await db.user.update({ where: { id: u.id }, data: { suspended: true, suspendedReason: str(body.note, 'Reason', { optional: true, max: 200 }) || 'Suspended by admin' } });
    const ms = await db.groupMember.findMany({ where: { userId: u.id, status: { in: ['JOINED', 'WAITLIST'] }, group: { status: { in: ['OPEN', 'CONFIRMED'] } } } });
    for (const m of ms) await leaveGroup(u, m.groupId, { waivePenalty: true }).catch(() => undefined);
  } else {
    await db.user.update({ where: { id: u.id }, data: { suspended: false, suspendedReason: null } });
  }
  return ok({ ok: true });
});
