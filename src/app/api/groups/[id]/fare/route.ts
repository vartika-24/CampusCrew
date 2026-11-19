import { handle, int, ok, readJson, forbidden, conflict } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { loadGroup, postSystem, recalcFare } from '@/lib/matching/engine';
import { db } from '@/lib/db';
import { splitFare } from '@/lib/fare';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  if (g.creatorId !== user.id) throw forbidden('Only the host (who pays the driver) can set the fare');
  if (g.status === 'CANCELLED') throw conflict('Trip cancelled');
  const body = await readJson(req);
  const total = int(body.total, 'Fare', 0, 50000);
  await db.tripGroup.update({ where: { id: g.id }, data: { fareTotal: total } });
  const split = (await recalcFare(g.id))!;
  const f = splitFare(total, split.riders);
  await postSystem(g.id, `Fare set to ₹${total.toLocaleString('en-IN')} → ₹${f.perRider} per rider (₹${f.baseShare} + ₹${f.fee} platform fee). Pay ${user.name.split(' ')[0]} via UPI.`);
  return ok({ split });
});
