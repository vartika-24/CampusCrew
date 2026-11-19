import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { leaveGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  return ok(await leaveGroup(user, params.id));
});
