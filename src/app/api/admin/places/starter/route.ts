import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { PLACES } from '@/lib/seed/data';

export const dynamic = 'force-dynamic';

/** Optional convenience: adds the IIITA pickup points / hubs from the project brief. Coordinates are approximate — verify them. */
export const POST = handle(async () => {
  await requireAdmin();
  let added = 0;
  for (const p of PLACES) {
    if (await db.place.findUnique({ where: { code: p.code } })) continue;
    await db.place.create({ data: { ...p, isPublic: true } });
    added++;
  }
  return ok({ added });
});
