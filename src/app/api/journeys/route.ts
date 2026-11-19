import { db } from '@/lib/db';
import { ApiError, bad, handle, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { assertNoDues } from '@/lib/safety/guards';
import { matchOrHost, validateLeg, normalizeLeg, type LegInput } from '@/lib/matching/engine';
import { parseLeg } from '@/lib/matching/parse';
import { serializeJourneys } from '@/lib/journeys';
import { toMinutes } from '@/lib/time';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  const journeys = await db.journey.findMany({ where: { ownerId: user.id }, include: { segments: true }, orderBy: { createdAt: 'desc' }, take: 50 });
  return ok({ journeys: await serializeJourneys(journeys) });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  if (!Array.isArray(body.legs) || body.legs.length < 1 || body.legs.length > 4) throw bad('A journey needs 1–4 legs');
  const legs: LegInput[] = body.legs.map((l, i) => normalizeLeg(parseLeg(l, `Leg ${i + 1}`)));
  await assertNoDues(user.id);

  for (let i = 0; i < legs.length; i++) {
    await validateLeg(user, legs[i]).catch((e) => { if (e instanceof ApiError) e.message = legs.length > 1 ? `Leg ${i + 1}: ${e.message}` : e.message; throw e; });
    if (i > 0) {
      const p = legs[i - 1], c = legs[i];
      if (p.destId !== c.originId) throw bad(`Leg ${i + 1} must start where leg ${i} ends`);
      if (c.date < p.date || (c.date === p.date && toMinutes(c.windowStart) < toMinutes(p.windowEnd))) throw bad(`Leg ${i + 1} must start after leg ${i} ends`);
    }
  }
  const title = str(body.title, 'Title', { optional: true, max: 80 });
  const place = await db.place.findMany({ where: { id: { in: [legs[0].originId, legs[legs.length - 1].destId] } } });
  const nm = (id: string) => place.find((p) => p.id === id)?.name.split(' (')[0] ?? '';
  const journey = await db.journey.create({
    data: {
      ownerId: user.id, title: title || `${nm(legs[0].originId)} → ${nm(legs[legs.length - 1].destId)}`,
      segments: { create: legs.map((l, i) => ({ ...l, userId: user.id, seq: i + 1, status: 'PLANNED' })) },
    },
    include: { segments: true },
  });

  const results: { segmentId: string; action?: string; groupId?: string; status?: string; error?: string }[] = [];
  if (body.autoMatch === true) {
    for (const s of [...journey.segments].sort((a, b) => a.seq - b.seq)) {
      try {
        const r = await matchOrHost(user, s.id);
        results.push({ segmentId: s.id, action: r.action, groupId: r.groupId, status: r.status });
      } catch (e) {
        results.push({ segmentId: s.id, error: e instanceof ApiError ? e.message : 'Could not match this leg' });
      }
    }
  }
  const fresh = await db.journey.findUniqueOrThrow({ where: { id: journey.id }, include: { segments: true } });
  return ok({ journey: (await serializeJourneys([fresh]))[0], results }, { status: 201 });
});
