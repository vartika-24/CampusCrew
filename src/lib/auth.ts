import { cookies, headers } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { db } from './db';
import { SESSION_COOKIE } from './constants';
import { forbidden, unauthorized } from './api';
import type { User } from '@prisma/client';

const DEV_SECRET = 'campuscrew-dev-secret-change-me-please-0123456789';

/** Session-signing key. Production (non-demo) refuses to run without a strong AUTH_SECRET. */
function secretKey(): Uint8Array {
  const v = process.env.AUTH_SECRET;
  if (!v) {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') throw new Error('AUTH_SECRET must be set in production (use a random string of 32+ characters).');
    return new TextEncoder().encode(DEV_SECRET);
  }
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true' && v.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters in production.');
  return new TextEncoder().encode(v);
}

export { isDemoMode } from './config';

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({ uid: userId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('14d').sign(secretKey());
}

/** Short-lived token proving the email passed OTP verification (used by onboarding). */
export async function signSignupToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: 'signup' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30m').sign(secretKey());
}

export async function verifySignupToken(token: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== 'signup' || typeof payload.email !== 'string') throw new Error('bad');
    return payload.email;
  } catch {
    throw unauthorized('Signup session expired. Please verify your email again.');
  }
}

export async function setSessionCookie(userId: string) {
  const token = await signSession(userId);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: headers().get('x-forwarded-proto') === 'https',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function getUserFromToken(token?: string | null): Promise<User | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.uid !== 'string') return null;
    return await db.user.findUnique({ where: { id: payload.uid } });
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<User | null> {
  return getUserFromToken(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const u = await getSessionUser();
  if (!u) throw unauthorized();
  if (u.suspended) throw forbidden('Your account is suspended. Contact the Student Affairs office.', 'SUSPENDED');
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (u.role !== 'ADMIN') throw forbidden('Admin access only');
  return u;
}

export async function getUserFromRequest(req: Request): Promise<User | null> {
  const raw = req.headers.get('cookie') ?? '';
  const m = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return getUserFromToken(m ? decodeURIComponent(m.slice(SESSION_COOKIE.length + 1)) : null);
}

/** Public projection of a user (never includes ID card image or other private fields). */
export function publicUser(u: User) {
  return {
    id: u.id, email: u.email, name: u.name, role: u.role, department: u.department, year: u.year,
    hostel: u.hostel, gender: u.gender, genderLocked: u.genderLocked, rollNumber: u.rollNumber,
    idCardStatus: u.idCardStatus, trustScore: u.trustScore, completedRides: u.completedRides,
    buddyVisible: u.buddyVisible, upiId: u.upiId, suspended: u.suspended,
    ratingAvg: u.ratingCount ? Math.round((u.ratingSum / u.ratingCount) * 10) / 10 : null,
    cancelCount: u.cancelCount, lateCancels: u.lateCancels, idType: u.idType, idRejectReason: u.idRejectReason, isDemo: u.isDemo,
  };
}
