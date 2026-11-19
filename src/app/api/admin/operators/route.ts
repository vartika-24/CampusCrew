import { db } from '@/lib/db';
import { handle, ok, readJson, conflict } from '@/lib/api';
import { parseOperator } from '@/lib/adminparse';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  return ok({ operators: await db.operator.findMany({ orderBy: { name: 'asc' } }) });
});

export const POST = handle(async (req) => {
  await requireAdmin();
  const o = parseOperator(await readJson(req));
  if (await db.operator.findUnique({ where: { plate: o.plate } })) throw conflict('An operator with this plate already exists');
  return ok({ operator: await db.operator.create({ data: { ...o, rating: 0, active: true } }) }, { status: 201 });
});
