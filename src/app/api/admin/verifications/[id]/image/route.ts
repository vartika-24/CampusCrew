import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Streams the private ID image to an admin only. Never cached, never public. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN' || admin.suspended) return new Response('Forbidden', { status: 403 });
  const doc = await db.idDocument.findUnique({ where: { userId: params.id } });
  if (!doc) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(doc.data), {
    headers: { 'Content-Type': doc.mime, 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline', 'Referrer-Policy': 'no-referrer' },
  });
}
