import { db } from '@/lib/db';
import { forbidden, handle, ok, readJson , readJsonOpt} from "@/lib/api";
import { requireUser } from '@/lib/auth';
import { newToken } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

/** Returns the public read-only tracking path; `rotate: true` revokes the old link. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const body = await readJsonOpt(req);
  const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: params.id, userId: user.id } }, include: { group: true } });
  if (!m || m.status !== 'JOINED') throw forbidden('Only riders can share this trip');
  let token = m.group.shareToken;
  if (body.rotate === true) {
    token = newToken();
    await db.tripGroup.update({ where: { id: params.id }, data: { shareToken: token } });
  }
  return ok({ token, path: `/track/${token}` });
});
