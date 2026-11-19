import { db } from '@/lib/db';
import { handle, notFound, ok, oneOf, readJson, str } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { postSystem } from '@/lib/matching/engine';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = await readJson(req);
  oneOf(body.action, 'action', ['resolve'] as const);
  const a = await db.emergencyAlert.findUnique({ where: { id: params.id } });
  if (!a) throw notFound('Alert not found');
  const note = str(body.note, 'Note', { optional: true, max: 300 }) || 'Resolved by campus security.';
  await db.emergencyAlert.update({ where: { id: a.id }, data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedNote: note } });
  await postSystem(a.groupId, `Campus Security (${admin.name.split(' ')[0]}) marked the SOS as resolved.`);
  await notify(a.userId, 'SAFETY', 'SOS resolved', note, `/trips/${a.groupId}`);
  return ok({ ok: true });
});
