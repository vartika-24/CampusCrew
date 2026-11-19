import { db } from '@/lib/db';
import { forbidden, handle, ok, readJson, str } from '@/lib/api';
import { isDemoMode, publicUser, setSessionCookie } from '@/lib/auth';
import { normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

const DEMO_EMAILS = ['student.female@iiita.ac.in', 'student.male@iiita.ac.in', 'student.lowtrust@iiita.ac.in', 'admin@iiita.ac.in'];

export const POST = handle(async (req) => {
  if (!isDemoMode()) throw forbidden('Demo login is disabled');
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email'));
  if (!DEMO_EMAILS.includes(email)) throw forbidden('Not a demo account');
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw forbidden('Demo data is not seeded. Run `npm run db:seed`.');
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(user.id);
  return ok({ user: publicUser(user) });
});
