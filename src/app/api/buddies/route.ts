import { db } from '@/lib/db';
import { bad, handle, ok, readJson, str } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { DATE_RE } from '@/lib/time';
import { findTransit, normalizeTransit } from '@/lib/transit';

export const dynamic = 'force-dynamic';

/** Same-train / same-flight buddy search. Privacy-first: opt-in only, same college, minimal fields. */
export const GET = handle(async (req) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams;
  const t = normalizeTransit(q.get('number') ?? '');
  const date = q.get('date') ?? '';
  if (!t) throw bad('Enter a 5-digit train number (e.g. 12301) or flight number (e.g. 6E-2134)');
  if (!DATE_RE.test(date)) throw bad('Pick a travel date');
  const info = findTransit(t.number) ?? null;
  const domain = user.email.split('@')[1];
  const mine = await db.buddyEntry.findUnique({ where: { userId_number_date: { userId: user.id, number: t.number, date } } });
  if (!user.buddyVisible) return ok({ optInRequired: true, buddies: [], transit: { ...t, info }, joined: !!mine });

  const entries = await db.buddyEntry.findMany({
    where: {
      number: t.number, date, userId: { not: user.id },
      user: { buddyVisible: true, suspended: false, emailVerified: true, idCardStatus: 'VERIFIED', email: { endsWith: `@${domain}` } },
    },
    include: { user: true }, orderBy: { user: { trustScore: 'desc' } },
  });
  // Only these five fields are ever exposed: first name, department, year, trust score, train/flight number.
  const buddies = entries.map((e) => ({
    entryId: e.id, firstName: e.user.name.split(' ')[0], department: e.user.department, year: e.user.year, trustScore: e.user.trustScore, number: e.number, kind: e.kind,
  }));
  return ok({ optInRequired: false, buddies, transit: { ...t, info }, joined: !!mine });
});

export const POST = handle(async (req) => {
  const user = await requireUser();
  const body = await readJson(req);
  const t = normalizeTransit(str(body.number, 'Train / flight number', { max: 12 }));
  const date = str(body.date, 'Date');
  if (!t) throw bad('Enter a valid train or flight number');
  if (!DATE_RE.test(date)) throw bad('Invalid date');
  const e = await db.buddyEntry.upsert({
    where: { userId_number_date: { userId: user.id, number: t.number, date } },
    create: { userId: user.id, kind: t.kind, number: t.number, date }, update: {},
  });
  return ok({ entry: e }, { status: 201 });
});

export const DELETE = handle(async (req) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get('id') ?? '';
  await db.buddyEntry.deleteMany({ where: { id, userId: user.id } });
  return ok({ ok: true });
});
