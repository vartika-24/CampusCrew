import { db } from '@/lib/db';
import { handle, ok, readJson, conflict } from '@/lib/api';
import { parsePlace } from '@/lib/adminparse';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const places = await db.place.findMany({ orderBy: [{ kind: 'asc' }, { name: 'asc' }] });
  return ok({ places });
});

export const POST = handle(async (req) => {
  await requireAdmin();
  const p = parsePlace(await readJson(req));
  if (await db.place.findUnique({ where: { code: p.code } })) throw conflict('A place with this code already exists');
  return ok({ place: await db.place.create({ data: { ...p, isPublic: true } }) }, { status: 201 });
});
