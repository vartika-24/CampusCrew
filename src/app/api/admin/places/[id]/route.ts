import { db } from '@/lib/db';
import { handle, notFound, ok, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { parsePlace } from '@/lib/adminparse';

export const dynamic = 'force-dynamic';

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const body = await readJson(req);
  const p = await db.place.findUnique({ where: { id: params.id } });
  if (!p) throw notFound('Place not found');
  if (typeof body.isPublic === 'boolean' && Object.keys(body).length === 1) {
    return ok({ place: await db.place.update({ where: { id: p.id }, data: { isPublic: body.isPublic } }) });
  }
  const data = parsePlace({ ...p, ...body });
  return ok({ place: await db.place.update({ where: { id: p.id }, data }) });
});

/** Deletes an unused place; places referenced by trips are deactivated instead (history stays intact). */
export const DELETE = handle<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const used = (await db.tripGroup.count({ where: { OR: [{ originId: params.id }, { destId: params.id }] } })) + (await db.tripSegment.count({ where: { OR: [{ originId: params.id }, { destId: params.id }] } }));
  if (used > 0) { await db.place.update({ where: { id: params.id }, data: { isPublic: false } }); return ok({ deactivated: true }); }
  await db.place.deleteMany({ where: { id: params.id } });
  return ok({ deleted: true });
});
