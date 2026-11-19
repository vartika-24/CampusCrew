import { db } from '@/lib/db';
import { ApiError, bad, forbidden, handle, ok, readJson, str } from '@/lib/api';
import { publicUser, setSessionCookie, signSignupToken } from '@/lib/auth';
import { authMode, isAdminEmail } from '@/lib/config';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { isCollegeEmail, normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/**
 * Direct sign-in with a college email (AUTH_MODE=instant). No code is sent or shown.
 * Existing account -> signed in. New email -> onboarding token.
 */
export const POST = handle(async (req) => {
  if (authMode() !== 'instant') throw forbidden('Direct sign-in is not enabled on this server', 'INSTANT_DISABLED');
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email', { max: 120 }));
  if (!isCollegeEmail(email)) throw bad('Use your IIIT Allahabad email (you@iiita.ac.in).', 'BAD_DOMAIN');
  if (isAdminEmail(email)) throw forbidden('Admin accounts must sign in with an emailed code.', 'ADMIN_NEEDS_OTP');
  if (rateLimited(`instant-ip:${clientIp(req)}`, 30, 10 * 60_000)) throw new ApiError(429, 'Too many attempts. Try again in a few minutes.', 'RATE_LIMITED');

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return ok({ needsOnboarding: true, signupToken: await signSignupToken(email), email });
  if (user.role === 'ADMIN') throw forbidden('Admin accounts must sign in with an emailed code.', 'ADMIN_NEEDS_OTP');
  if (user.suspended) throw new ApiError(403, 'This account is suspended. Contact the Student Affairs office.', 'SUSPENDED');
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(user.id);
  return ok({ needsOnboarding: false, user: publicUser(user) });
});
