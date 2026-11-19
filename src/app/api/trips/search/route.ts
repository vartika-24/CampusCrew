import type { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { effectiveGender, genderWhere } from '@/lib/safety/gender';
import { serializeGroup } from '@/lib/groups';
import { toLite } from '@/lib/matching/engine';
import { scoreMatch } from '@/lib/matching/scoring';
import { DATE_RE, TIME_RE, todayIST } from '@/lib/time';
import { GENDER_PREFS, MODES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const where: Prisma.TripGroupWhereInput = {
    status: { in: ['OPEN', 'CONFIRMED'] },
    date: { gte: todayIST() },
    ...genderWhere(effectiveGender(user)), // HARD FILTER: gendered trips never leak to the wrong gender
  };
  if (q.get('mine') !== '1') where.members = { none: { userId: user.id, status: { in: ['JOINED', 'WAITLIST'] } } };
  const origin = q.get('origin'), dest = q.get('dest'), mode = q.get('mode'), pref = q.get('pref'), date = q.get('date');
  if (origin) where.originId = origin;
  if (dest) where.destId = dest;
  if (mode && (MODES as readonly string[]).includes(mode)) where.mode = mode;
  // Extra preference filter is AND-ed with the hard gender filter, never replacing it.
  if (pref && (GENDER_PREFS as readonly string[]).includes(pref)) where.AND = [{ genderPref: pref }];
  if (date && DATE_RE.test(date)) where.date = date;

  const groups = await db.tripGroup.findMany({
    where, take: 80, orderBy: [{ date: 'asc' }, { windowStart: 'asc' }],
    include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } } },
  });

  const from = q.get('from'), to = q.get('to');
  const luggage = Math.min(3, Math.max(0, Number(q.get('luggage') ?? 0) || 0));
  const hasWindow = !!(from && to && TIME_RE.test(from) && TIME_RE.test(to) && from < to);
  const rows = await Promise.all(groups.map(async (g) => {
    const score = scoreMatch(toLite(g), {
      window: hasWindow ? { start: from!, end: to! } : { start: g.windowStart, end: g.windowEnd },
      trustScore: user.trustScore, hostel: user.hostel, luggage, completedRides: user.completedRides, punctualCount: user.punctualCount,
    });
    return { g, score };
  }));
  const ranked = hasWindow ? rows.sort((a, b) => Number(b.score.eligible) - Number(a.score.eligible) || b.score.total - a.score.total) : rows;
  const trips = await Promise.all(ranked.map(({ g, score }) => serializeGroup(g, user, score)));
  return ok({ trips, ranked: hasWindow });
});
