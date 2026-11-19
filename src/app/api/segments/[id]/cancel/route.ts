import { db } from '@/lib/db';
import { handle, notFound, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { leaveGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const seg = await db.tripSegment.findUnique({ where: { id: params.id } });
  if (!seg || seg.userId !== user.id) throw notFound('Leg not found');
  if (seg.groupId && ['MATCHED', 'WAITLISTED'].includes(seg.status)) return ok({ leave: await leaveGroup(user, seg.groupId) });
  await db.tripSegment.update({ where: { id: seg.id }, data: { status: 'CANCELLED' } });
  return ok({ leave: null });
});
