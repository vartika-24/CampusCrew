import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { serializeGroup } from '@/lib/groups';
import { todayIST } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const ms = await db.groupMember.findMany({
    where: { userId: user.id, status: { in: ['JOINED', 'WAITLIST'] }, group: { status: { not: 'CANCELLED' } } },
    include: { group: { include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } } } },
    orderBy: { group: { date: 'asc' } },
    take: 100,
  });
  const dtos = await Promise.all(ms.map((m) => serializeGroup(m.group, user)));
  const today = todayIST();
  const active = dtos.filter((t) => t.status === 'IN_PROGRESS');
  const upcoming = dtos.filter((t) => t.status !== 'COMPLETED' && t.status !== 'IN_PROGRESS' && t.date >= today);
  const past = dtos.filter((t) => t.status === 'COMPLETED' || (t.status !== 'IN_PROGRESS' && t.date < today)).reverse();
  return ok({ active, upcoming, past });
});
