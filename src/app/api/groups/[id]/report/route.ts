import { db } from '@/lib/db';
import { forbidden, handle, ok, oneOf, readJson, str, bad } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { REPORT_TYPES } from '@/lib/constants';
import { loadGroup } from '@/lib/matching/engine';
import { recomputeTrust } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  if (!g.members.some((m) => m.userId === user.id && m.status !== 'LEFT')) throw forbidden('Only people in this trip can report');
  const body = await readJson(req);
  const type = oneOf(body.type, 'type', REPORT_TYPES);
  const description = str(body.description, 'Description', { min: 10, max: 800 });
  const targetId = typeof body.targetId === 'string' && body.targetId ? body.targetId : null;
  if (targetId) {
    if (targetId === user.id) throw bad('You cannot report yourself');
    if (!g.members.some((m) => m.userId === targetId)) throw bad('That person is not in this trip');
  }
  const r = await db.report.create({ data: { reporterId: user.id, targetId, groupId: g.id, type, description } });
  if (targetId) await recomputeTrust(targetId); // unresolved report weighs on trust until moderated
  return ok({ id: r.id }, { status: 201 });
});
