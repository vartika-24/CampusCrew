import { handle, ok } from '@/lib/api';
import { clearSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const POST = handle(async () => {
  clearSessionCookie();
  return ok({ ok: true });
});
