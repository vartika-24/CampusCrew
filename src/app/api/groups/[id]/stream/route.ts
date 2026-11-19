// Server-Sent Events: pushes new chat messages and group-state changes to matched riders.
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { messageDTO } from '@/lib/groups';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req);
  if (!user || user.suspended) return new Response('Unauthorized', { status: 401 });
  const member = await db.groupMember.findUnique({ where: { groupId_userId: { groupId: params.id, userId: user.id } } });
  if (!member || member.status !== 'JOINED') return new Response('Forbidden', { status: 403 });

  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      const lastEventId = new URL(req.url).searchParams.get('after');
      let cursor = lastEventId ? new Date(lastEventId) : new Date();
      const seen = new Set<string>();
      let version = '';
      let beats = 0;
      controller.enqueue(enc.encode('retry: 3000\n\n'));
      send('ready', { ok: true });

      const tick = async () => {
        try {
          const msgs = await db.message.findMany({
            where: { groupId: params.id, createdAt: { gte: cursor } }, orderBy: { createdAt: 'asc' }, take: 100,
            include: { user: { select: { name: true } } },
          });
          for (const m of msgs) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            send('message', messageDTO(m));
            if (m.createdAt > cursor) cursor = m.createdAt;
          }
          if (seen.size > 400) [...seen].slice(0, 200).forEach((id) => seen.delete(id));
          const g = await db.tripGroup.findUnique({ where: { id: params.id }, select: { updatedAt: true, status: true } });
          const v = g ? `${g.updatedAt.getTime()}:${g.status}` : 'gone';
          if (v !== version) { if (version) send('state', { version: v }); version = v; }
          if (++beats % 10 === 0) controller.enqueue(enc.encode(': keep-alive\n\n'));
        } catch { /* transient db error: next tick retries */ }
      };
      timer = setInterval(tick, 1500);
      req.signal.addEventListener('abort', () => { closed = true; if (timer) clearInterval(timer); try { controller.close(); } catch { /* already closed */ } });
    },
    cancel() { closed = true; if (timer) clearInterval(timer); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
