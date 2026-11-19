import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { db } from '@/lib/db';
import { ApiError, bad, handle, ok, readJson, str } from '@/lib/api';
import { isDemoMode } from '@/lib/auth';
import { isCollegeEmail, normalizeEmail } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = normalizeEmail(str(body.email, 'Email', { max: 120 }));
  if (!isCollegeEmail(email)) throw bad('Use your college email (ending in .ac.in or .edu), e.g. you@iiita.ac.in', 'BAD_DOMAIN');

  const recent = await db.otpCode.count({ where: { email, createdAt: { gt: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= 5) throw new ApiError(429, 'Too many OTP requests. Try again in a few minutes.', 'RATE_LIMITED');

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await db.otpCode.create({ data: { email, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + 10 * 60_000) } });
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, suspended: true } });
  if (existing?.suspended) throw new ApiError(403, 'This account is suspended. Contact the Student Affairs office.', 'SUSPENDED');

  // Production would email the OTP. In demo/dev mode the simulated OTP is returned for instant testing.
  return ok({ sent: true, isNewUser: !existing, expiresInMinutes: 10, ...(isDemoMode() ? { devOtp: code } : {}) });
});
