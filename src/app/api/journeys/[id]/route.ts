import { db } from '@/lib/db';
import { handle, notFound, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { serializeJourneys } from '@/lib/journeys';

export const dynamic = 'force-dynamic';

export const GET = handle<{ id: string }>(async (_req, { params }) => {
  const user = await requireUser();
  const j = await db.journey.findUnique({ where: { id: params.id }, include: { segments: true } });
  if (!j || (j.ownerId !== user.id && user.role !== 'ADMIN')) throw notFound('Journey not found');
  return ok({ journey: (await serializeJourneys([j]))[0] });
});
