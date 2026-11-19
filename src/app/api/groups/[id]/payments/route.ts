import { db } from '@/lib/db';
import { forbidden, handle, notFound, ok, oneOf, readJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { loadGroup, postSystem } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

/** Members mark their own share PAID/UNPAID; the host (payee) can set anyone's. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  const body = await readJson(req);
  const status = oneOf(body.status, 'status', ['PAID', 'UNPAID'] as const);
  const targetId = typeof body.userId === 'string' ? body.userId : user.id;
  if (targetId !== user.id && g.creatorId !== user.id) throw forbidden('Only the host can update other riders');
  const m = g.members.find((x) => x.userId === targetId && x.status === 'JOINED');
  if (!m) throw notFound('Rider not found');
  if (g.creatorId === targetId) return ok({ paymentStatus: 'PAID' });
  await db.groupMember.update({ where: { id: m.id }, data: { paymentStatus: status, paidAt: status === 'PAID' ? new Date() : null } });
  await postSystem(g.id, `${m.user.name.split(' ')[0]} marked ₹${m.shareAmount} as ${status === 'PAID' ? 'paid ✔' : 'unpaid'}`);
  return ok({ paymentStatus: status });
});
