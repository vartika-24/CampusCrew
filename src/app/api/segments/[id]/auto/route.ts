import { db } from '@/lib/db';
import { conflict, handle, notFound, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { matchOrHost } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const seg = await db.tripSegment.findUnique({ where: { id: params.id } });
  if (!seg || seg.userId !== user.id) throw notFound('Leg not found');
  if (seg.status === 'MATCHED' || seg.status === 'WAITLISTED') throw conflict('This leg is already in a crew');
  return ok(await matchOrHost(user, seg.id));
});
