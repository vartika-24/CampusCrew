import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { demandPlan } from '@/lib/admin';
import { DATE_RE, addDays, todayIST } from '@/lib/time';
import { getSettings } from '@/lib/surge';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireAdmin();
  const q = new URL(req.url).searchParams.get('date');
  const s = await getSettings();
  const peak = addDays(s.breakStart ?? todayIST(), 1);
  return ok(await demandPlan(q && DATE_RE.test(q) ? q : peak));
});
