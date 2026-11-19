import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { SESSION_COOKIE } from '@/lib/constants';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'campuscrew-dev-secret-change-me-please-0123456789');
const PROTECTED = ['/dashboard', '/trips', '/journeys', '/buddies', '/surge', '/eco', '/profile', '/admin'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let ok = false;
  if (token) {
    try { await jwtVerify(token, secret); ok = true; } catch { ok = false; }
  }
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!api|_next|.*\\..*).*)'] };
