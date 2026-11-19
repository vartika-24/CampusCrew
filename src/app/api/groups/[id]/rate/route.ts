import { db } from '@/lib/db';
import { conflict, forbidden, handle, int, ok, readJson, str, bad } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { activeMembers, loadGroup } from '@/lib/matching/engine';
import { recomputeTrust } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  if (g.status !== 'COMPLETED') throw conflict('You can rate co-riders after the trip is completed');
  const riders = activeMembers(g).filter((m) => m.boarded);
  if (!riders.some((m) => m.userId === user.id)) throw forbidden('Only riders who took this trip can rate');
  const body = await readJson(req);
  const rateeId = str(body.rateeId, 'rateeId');
  if (rateeId === user.id) throw bad('You cannot rate yourself');
  if (!riders.some((m) => m.userId === rateeId)) throw bad('That person was not on this trip');
  const score = int(body.score, 'Rating', 1, 5);
  const punctual = body.punctual !== false;
  if (await db.rating.findUnique({ where: { groupId_raterId_rateeId: { groupId: g.id, raterId: user.id, rateeId } } })) throw conflict('Already rated');
  await db.rating.create({ data: { groupId: g.id, raterId: user.id, rateeId, score, punctual } });
  await db.user.update({ where: { id: rateeId }, data: { ratingSum: { increment: score }, ratingCount: { increment: 1 }, ...(punctual ? { punctualCount: { increment: 1 } } : {}) } });
  return ok({ trustScore: await recomputeTrust(rateeId) });
});
