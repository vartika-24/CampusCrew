import { db } from '@/lib/db';
import { conflict, forbidden, handle, int, ok, readJson , readJsonOpt} from "@/lib/api";
import { requireUser } from '@/lib/auth';
import { activeMembers, loadGroup, postSystem } from '@/lib/matching/engine';
import { fromMinutes, toMinutes } from '@/lib/time';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Live delay simulator: shifts the pickup window, alerts the chat, enables penalty-free exit. */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const user = await requireUser();
  const g = await loadGroup(params.id);
  if (!activeMembers(g).some((m) => m.userId === user.id)) throw forbidden('Only riders can report a delay');
  if (!['OPEN', 'CONFIRMED'].includes(g.status)) throw conflict('Delays can only be reported before the ride starts');
  const body = await readJsonOpt(req);
  const minutes = body.minutes === undefined ? 25 : int(body.minutes, 'Delay', 5, 180);
  const start = fromMinutes(toMinutes(g.windowStart) + minutes);
  const end = fromMinutes(toMinutes(g.windowEnd) + minutes);
  await db.tripGroup.update({ where: { id: g.id }, data: { delayMins: { increment: minutes }, windowStart: start, windowEnd: end } });
  const label = g.mode === 'FLIGHT' ? `Flight ${g.flightNumber ?? ''}` : g.mode === 'TRAIN' ? `Train ${g.trainNumber ?? ''}` : g.trainNumber ? `Train ${g.trainNumber}` : g.flightNumber ? `Flight ${g.flightNumber}` : 'Ride';
  await postSystem(g.id, `${label.trim()} delayed by ${minutes} mins — pickup window shifted to ${start}–${end}. You may leave or re-group penalty-free.`);
  for (const m of activeMembers(g)) if (m.userId !== user.id) await notify(m.userId, 'INFO', 'Delay alert', `${label.trim()} delayed by ${minutes} mins. New pickup window ${start}–${end}.`, `/trips/${g.id}`);
  return ok({ delayMins: g.delayMins + minutes, windowStart: start, windowEnd: end });
});
