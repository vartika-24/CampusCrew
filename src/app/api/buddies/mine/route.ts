import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { todayIST } from '@/lib/time';
import { findTransit } from '@/lib/transit';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const entries = await db.buddyEntry.findMany({ where: { userId: user.id, date: { gte: todayIST() } }, orderBy: { date: 'asc' } });
  return ok({ buddyVisible: user.buddyVisible, entries: entries.map((e) => ({ id: e.id, kind: e.kind, number: e.number, date: e.date, info: findTransit(e.number) ?? null })) });
});
