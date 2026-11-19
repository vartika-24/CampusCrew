import { createHash } from 'crypto';
import { db } from './db';
import { ApiError, bad, conflict } from './api';
import { validateIdImage } from './image';
import { clientIp, rateLimited } from './ratelimit';
import { readGovernmentId, type Gender } from './idocr';

export const ID_TYPES = ['AADHAAR', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENCE'] as const;
export const ID_TYPE_LABEL: Record<string, string> = {
  AADHAAR: 'Aadhaar (masked Aadhaar is fine)', PASSPORT: 'Passport', VOTER_ID: 'Voter ID (EPIC)', DRIVING_LICENCE: 'Driving licence',
};

/**
 * Mandatory government-ID check. The image is validated, read with OCR, and discarded — nothing but a hash is kept.
 * Returns the gender PRINTED ON THE ID (never self-declared).
 */
export async function verifyIdUpload(req: Request, form: FormData, opts: { name: string; email: string; forUserId?: string }): Promise<{ gender: Gender; idType: string; hash: string }> {
  const file = form.get('idImage');
  if (!(file instanceof File) || file.size === 0) throw bad('A photo of your government ID is required (Aadhaar, passport, voter ID or driving licence).', 'ID_IMAGE_REQUIRED');
  const idType = String(form.get('idType') ?? '');
  if (!(ID_TYPES as readonly string[]).includes(idType)) throw bad('Choose which government ID you are uploading', 'ID_TYPE_REQUIRED');
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateIdImage(buf);
  if (!v.ok) throw bad(v.error, 'ID_IMAGE_INVALID');
  if (rateLimited(`idocr:${opts.email}`, 8, 30 * 60_000) || rateLimited(`idocr-ip:${clientIp(req)}`, 25, 30 * 60_000)) {
    throw new ApiError(429, 'Too many ID attempts. Please wait a few minutes and try again.', 'RATE_LIMITED');
  }
  const hash = createHash('sha256').update(buf).digest('hex');
  const dup = await db.user.findFirst({ where: { idDocHash: hash, ...(opts.forUserId ? { id: { not: opts.forUserId } } : {}) }, select: { id: true } });
  if (dup) throw conflict('This ID has already been used for another account.', 'ID_DUPLICATE');

  const r = await readGovernmentId(buf, { idType, name: opts.name });
  if (!r.ok) throw new ApiError(422, r.message, r.code);
  return { gender: r.gender, idType, hash };
}
