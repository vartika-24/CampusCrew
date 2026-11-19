import { db } from '@/lib/db';
import { handle, notFound, ok, oneOf, readJson, str } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { leaveGroup } from '@/lib/matching/engine';
import { recomputeTrust } from '@/lib/safety/guards';
import { TRUST } from '@/lib/safety/trust';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

export const POST = handle<{ id: string }>(async (req, { params }) => {
  await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body.action, 'action', ['resolve', 'penalize', 'suspend'] as const);
  const note = str(body.note, 'Note', { optional: true, max: 300 });
  const r = await db.report.findUnique({ where: { id: params.id }, include: { target: true } });
  if (!r) throw notFound('Report not found');

  if (action === 'resolve') {
    await db.report.update({ where: { id: r.id }, data: { status: 'RESOLVED', resolution: note || 'Reviewed; no further action.', resolvedAt: new Date() } });
  } else if (action === 'penalize') {
    await db.report.update({ where: { id: r.id }, data: { status: 'PENALIZED', resolution: note || `Trust score reduced by ${TRUST.ADMIN_PENALTY}.`, resolvedAt: new Date() } });
    if (r.targetId) {
      await db.user.update({ where: { id: r.targetId }, data: { trustAdjust: { decrement: TRUST.ADMIN_PENALTY } } });
      await notify(r.targetId, 'PENALTY', 'Trust score penalty', `Student Affairs reduced your trust score by ${TRUST.ADMIN_PENALTY} after a report review.${note ? ' Note: ' + note : ''}`, '/profile');
    }
  } else {
    await db.report.update({ where: { id: r.id }, data: { status: 'SUSPENDED', resolution: note || 'Account suspended pending inquiry.', resolvedAt: new Date() } });
    if (r.targetId) {
      await db.user.update({ where: { id: r.targetId }, data: { suspended: true, suspendedReason: note || `Report ${r.type}` } });
      // Remove from upcoming crews so riders are not left with a suspended co-rider.
      const ms = await db.groupMember.findMany({ where: { userId: r.targetId, status: { in: ['JOINED', 'WAITLIST'] }, group: { status: { in: ['OPEN', 'CONFIRMED'] } } } });
      for (const m of ms) await leaveGroup(r.target!, m.groupId, { waivePenalty: true }).catch(() => undefined);
    }
  }
  if (r.targetId) await recomputeTrust(r.targetId);
  return ok({ ok: true });
});
