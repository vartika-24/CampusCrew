import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { db } from '@/lib/db';
import { ApiError, bad, handle, ok, readJson, str } from '@/lib/api';
import { authMode, exposeDevOtp } from '@/lib/config';
import { emailConfigured, otpEmail, sendEmail } from '@/lib/email';
import { clientIp, rateLimited } from '@/lib/ratelimit';
import { isCollegeEmail, normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email', { max: 120 }));
  if (!isCollegeEmail(email)) throw bad('Use your IIIT Allahabad email (you@iiita.ac.in).', 'BAD_DOMAIN');
  if (rateLimited(`otp-ip:${clientIp(req)}`, 20, 10 * 60_000)) throw new ApiError(429, 'Too many requests. Try again in a few minutes.', 'RATE_LIMITED');

  if (authMode() === 'instant' && !emailConfigured()) throw new ApiError(400, 'This server signs you in directly with your college email. Use the Continue button.', 'USE_INSTANT');
  const deliver = emailConfigured();
  if (!deliver && !exposeDevOtp()) throw new ApiError(503, 'Email delivery is not configured on this server. Please contact the administrator.', 'EMAIL_NOT_CONFIGURED');

  const last = await db.otpCode.findFirst({ where: { email }, orderBy: { createdAt: 'desc' } });
  if (last && Date.now() - last.createdAt.getTime() < 30_000) throw new ApiError(429, 'Please wait 30 seconds before requesting another code.', 'RATE_LIMITED');
  const recent = await db.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 5) throw new ApiError(429, 'Too many OTP requests. Try again in a few minutes.', 'RATE_LIMITED');

  const existing = await db.user.findUnique({ where: { email }, select: { suspended: true } });
  if (existing?.suspended) throw new ApiError(403, 'This account is suspended. Contact the Student Affairs office.', 'SUSPENDED');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const rec = await db.otpCode.create({ data: { email, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 10 * 60_000) } });

  if (deliver) {
    try {
      await sendEmail({ to: email, ...otpEmail(code) });
    } catch (e) {
      console.error('[otp] email delivery failed:', (e as Error).message);
      await db.otpCode.delete({ where: { id: rec.id } }).catch(() => undefined);
      throw new ApiError(502, 'We could not send the email right now. Please try again shortly.', 'EMAIL_FAILED');
    }
    return ok({ sent: true, expiresInMinutes: 10 });
  }
  // Automated tests only (EXPOSE_DEV_OTP=true). The code is never shown in the app UI.
  return ok({ sent: true, expiresInMinutes: 10, devOtp: code });
});
