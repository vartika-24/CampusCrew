import { db } from '@/lib/db';
import { bad, handle, ok, readJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { assertVerified } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  if (body.visible === true) assertVerified(user);
  if (typeof body.visible !== 'boolean') throw bad('visible must be true or false');
  await db.user.update({ where: { id: user.id }, data: { buddyVisible: body.visible } });
  return ok({ buddyVisible: body.visible });
});
