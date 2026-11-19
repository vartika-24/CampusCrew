import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const bad = (m: string, code?: string, extra?: Record<string, unknown>) => new ApiError(400, m, code, extra);
export const unauthorized = (m = 'Please sign in') => new ApiError(401, m, 'UNAUTHENTICATED');
export const forbidden = (m = 'Not allowed', code?: string, extra?: Record<string, unknown>) => new ApiError(403, m, code ?? 'FORBIDDEN', extra);
export const notFound = (m = 'Not found') => new ApiError(404, m, 'NOT_FOUND');
export const conflict = (m: string, code?: string) => new ApiError(409, m, code ?? 'CONFLICT');

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { 'Cache-Control': 'no-store', ...(init?.headers ?? {}) } });
}

type Ctx<P> = { params: P };

/** Wraps a route handler: converts ApiError into JSON errors, hides unexpected failures. */
export function handle<P = Record<string, string>>(fn: (req: Request, ctx: Ctx<P>) => Promise<Response | object>) {
  return async (req: Request, ctx: Ctx<P>) => {
    try {
      const res = await fn(req, ctx);
      return res instanceof Response ? res : ok(res);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message, code: e.code, ...(e.extra ?? {}) }, { status: e.status, headers: { 'Cache-Control': 'no-store' } });
      }
      console.error('[api] unexpected', e);
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fallthrough */
  }
  throw bad('Invalid JSON body');
}

export const str = (v: unknown, field: string, opts: { min?: number; max?: number; optional?: boolean } = {}): string => {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    throw bad(`${field} is required`);
  }
  if (typeof v !== 'string') throw bad(`${field} must be text`);
  const s = v.trim();
  if (opts.min && s.length < opts.min) throw bad(`${field} must be at least ${opts.min} characters`);
  if (opts.max && s.length > opts.max) throw bad(`${field} must be at most ${opts.max} characters`);
  return s;
};

export const int = (v: unknown, field: string, min: number, max: number): number => {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) throw bad(`${field} must be a whole number between ${min} and ${max}`);
  return n;
};

export const oneOf = <T extends string>(v: unknown, field: string, allowed: readonly T[]): T => {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) throw bad(`${field} must be one of ${allowed.join(', ')}`);
  return v as T;
};

/** Like readJson but an empty/absent body yields {}. */
export async function readJsonOpt(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
