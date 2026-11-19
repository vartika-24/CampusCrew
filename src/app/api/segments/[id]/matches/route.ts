import { db } from '@/lib/db';
import { handle, notFound, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { candidateGroups } from '@/lib/matching/engine';
import { serializeGroup } from '@/lib/groups';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const seg = await db.tripSegment.findUnique({ where: { id: params.id } });
  if (!seg || seg.userId !== user.id) throw notFound('Leg not found');
  const cands = await candidateGroups(user, seg);
  const matches = await Promise.all(cands.map((c) => serializeGroup(c.group, user, c.score)));
  return ok({ segmentId: seg.id, matches });
});
