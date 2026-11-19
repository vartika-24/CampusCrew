import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { loadVisibleGroup } from '@/lib/matching/engine';
import { serializeGroup } from '@/lib/groups';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const g = await loadVisibleGroup(params.id, user);
  const dto = await serializeGroup(g, user);
  const myRatings = dto.isMember ? await db.rating.findMany({ where: { groupId: g.id, raterId: user.id }, select: { rateeId: true } }) : [];
  return ok({ trip: dto, rated: myRatings.map((r) => r.rateeId) });
});
