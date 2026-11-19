import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { surgeOverview } from '@/lib/surge';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireUser();
  return ok(await surgeOverview());
});
