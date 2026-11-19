// Server-Sent Events for the campus-security console: pushes live SOS state.
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { alertsDTO } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return new Response('Forbidden', { status: 403 });
  const enc = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => { if (!closed) controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); };
      let known = new Set<string>();
      let first = true;
      let beats = 0;
      controller.enqueue(enc.encode('retry: 3000\n\n'));
      const tick = async () => {
        try {
          const ids = (await db.emergencyAlert.findMany({ where: { status: 'ACTIVE' }, select: { id: true } })).map((a) => a.id);
          const current = new Set(ids);
          const fresh = ids.filter((id) => !known.has(id));
          const changed = fresh.length > 0 || [...known].some((id) => !current.has(id)) || first;
          if (changed) {
            const alerts = await alertsDTO(['ACTIVE']);
            send('sos', { active: alerts.length, alerts, newIds: first ? [] : fresh });
          }
          known = current; first = false;
          if (++beats % 10 === 0) controller.enqueue(enc.encode(': keep-alive\n\n'));
        } catch { /* retry next tick */ }
      };
      await tick();
      timer = setInterval(tick, 1500);
      req.signal.addEventListener('abort', () => { closed = true; if (timer) clearInterval(timer); try { controller.close(); } catch { /* closed */ } });
    },
    cancel() { closed = true; if (timer) clearInterval(timer); },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
