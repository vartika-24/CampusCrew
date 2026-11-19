import { handle, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { boardWithPin } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJson(req);
  return ok(await boardWithPin(user, params.id, str(body.pin, 'PIN', { max: 4 })));
});
