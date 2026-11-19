import { handle, ok } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { alertsDTO, reportsDTO } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await requireAdmin();
  const [active, recent, reports] = await Promise.all([alertsDTO(['ACTIVE']), alertsDTO(['RESOLVED']), reportsDTO()]);
  return ok({ alerts: [...active, ...recent.slice(0, 10)], activeCount: active.length, reports });
});
