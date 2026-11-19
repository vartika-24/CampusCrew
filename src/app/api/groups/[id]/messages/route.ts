import { db } from '@/lib/db';
import { forbidden, handle, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { touchGroup } from '@/lib/matching/engine';

export const dynamic = 'force-dynamic';

async function assertChatMember(groupId: string, userId: string) {
  const m = await db.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
  if (!m || m.status !== 'JOINED') throw forbidden('Chat is only for matched riders in this trip', 'NOT_MEMBER');
}

export const messageDTO = (m: { id: string; kind: string; body: string; createdAt: Date; userId: string | null; user: { name: string } | null }) => ({
  id: m.id, kind: m.kind, body: m.body, createdAt: m.createdAt.toISOString(), userId: m.userId, author: m.user ? m.user.name.split(' ')[0] : null,
});

export const GET = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  await assertChatMember(params.id, user.id);
  const after = new URL(req.url).searchParams.get('after');
  const msgs = await db.message.findMany({
    where: { groupId: params.id, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    include: { user: { select: { name: true } } }, orderBy: { createdAt: 'asc' }, take: 300,
  });
  return ok({ messages: msgs.map(messageDTO) });
});

export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  await assertChatMember(params.id, user.id);
  const body = await readJson(req);
  const text = str(body.body, 'Message', { min: 1, max: 600 });
  const m = await db.message.create({ data: { groupId: params.id, userId: user.id, kind: 'USER', body: text }, include: { user: { select: { name: true } } } });
  await touchGroup(params.id);
  return ok({ message: messageDTO(m) }, { status: 201 });
});
