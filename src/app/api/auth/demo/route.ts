import { db } from '@/lib/db';
import { forbidden, handle, ok, readJson, str } from '@/lib/api';
import { publicUser, setSessionCookie } from '@/lib/auth';
import { isDemoMode } from '@/lib/config';
import { normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const DEMO_EMAILS = ['student.female@iiita.ac.in', 'student.male@iiita.ac.in', 'student.lowtrust@iiita.ac.in', 'admin@iiita.ac.in'];

/** One-click login for the seeded demo accounts only; hard-disabled unless DEMO_MODE=true. */
export const POST = handle(async (req) => {
  if (!isDemoMode()) throw forbidden('Demo login is disabled');
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email'));
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isDemo || !DEMO_EMAILS.includes(email)) throw forbidden('Not a demo account');
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(user.id);
  return ok({ user: publicUser(user) });
});
