import { handle, ok, oneOf, readJson } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { transition } from '@/lib/lifecycle';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJson(req);
  const action = oneOf(body.action, 'action', ['confirm', 'start', 'restart', 'complete', 'cancel'] as const);
  return ok(await transition(user, params.id, action));
});
