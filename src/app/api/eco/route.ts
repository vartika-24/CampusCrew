import { handle, ok } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { ecoSummary } from '@/lib/eco';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  const user = await requireUser();
  return ok({ ...(await ecoSummary(user.id)), myHostel: user.hostel });
});
