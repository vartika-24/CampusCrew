import { db } from '@/lib/db';
import { handle, notFound, ok, readJson } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { parseOperator } from '@/lib/adminparse';

export const dynamic = 'force-dynamic';

export const PATCH = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const body = await readJson(req);
  const o = await db.operator.findUnique({ where: { id: params.id } });
  if (!o) throw notFound('Operator not found');
  if (typeof body.active === 'boolean' && Object.keys(body).length === 1) return ok({ operator: await db.operator.update({ where: { id: o.id }, data: { active: body.active } }) });
  return ok({ operator: await db.operator.update({ where: { id: o.id }, data: parseOperator({ ...o, ...body }) }) });
});

export const DELETE = handle<{ id: string }>(async (_req, { params }) => {
  await requireAdmin();
  const used = await db.tripGroup.count({ where: { operatorId: params.id } });
  if (used > 0) { await db.operator.update({ where: { id: params.id }, data: { active: false } }); return ok({ deactivated: true }); }
  await db.operator.deleteMany({ where: { id: params.id } });
  return ok({ deleted: true });
});
