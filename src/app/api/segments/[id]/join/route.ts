import { handle, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { joinGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJson(req);
  return ok(await joinGroup(user, str(body.groupId, 'groupId'), { segmentId: params.id }));
});
