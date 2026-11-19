import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { ApiError, bad, handle, ok, readJson, str } from '@/lib/api';
import { publicUser, setSessionCookie, signSignupToken } from '@/lib/auth';
import { isAdminEmail } from '@/lib/config';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { isCollegeEmail, normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email'));
  const otp = str(body.otp, 'OTP');
  if (!isCollegeEmail(email)) throw bad('Use your IIIT Allahabad email');
  if (!/^\d{6}$/.test(otp)) throw bad('OTP must be 6 digits');
  if (rateLimited(`verify-ip:${clientIp(req)}`, 40, 10 * 60_000)) throw new ApiError(429, 'Too many attempts. Try again in a few minutes.', 'RATE_LIMITED');

  const rec = await db.otpCode.findFirst({ where: { email, used: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!rec) throw new ApiError(400, 'OTP expired or not requested. Request a new one.', 'OTP_EXPIRED');
  if (rec.attempts >= 5) throw new ApiError(429, 'Too many wrong attempts. Request a new OTP.', 'RATE_LIMITED');
  if (!(await bcrypt.compare(otp, rec.codeHash))) {
    await db.otpCode.update({ where: { id: rec.id }, data: { attempts: { increment: 1 } } });
    throw new ApiError(400, 'Incorrect OTP', 'OTP_INVALID');
  }
  await db.otpCode.update({ where: { id: rec.id }, data: { used: true } });

  let user = await db.user.findUnique({ where: { email } });
  if (isAdminEmail(email)) {
    // Bootstrap admins (ADMIN_EMAILS env): created / promoted on first verified sign-in.
    const local = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    user = user
      ? user.role === 'ADMIN' ? user : await db.user.update({ where: { id: user.id }, data: { role: 'ADMIN', emailVerified: true, idCardStatus: 'VERIFIED' } })
      : await db.user.create({
          data: { email, name: local, rollNumber: `ADMIN-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, department: 'Administration', year: 1, hostel: null, gender: 'OTHER', genderLocked: true, role: 'ADMIN', emailVerified: true, idCardStatus: 'VERIFIED', trustScore: 100 },
        });
  }
  if (!user) return ok({ needsOnboarding: true, signupToken: await signSignupToken(email), email });
  if (user.suspended) throw new ApiError(403, 'This account is suspended. Contact the Student Affairs office.', 'SUSPENDED');
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSessionCookie(user.id);
  return ok({ needsOnboarding: false, user: publicUser(user) });
});
