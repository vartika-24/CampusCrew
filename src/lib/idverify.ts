import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { db } from './db';
import { bad, conflict } from './api';
import { validateIdImage } from './image';

export const ID_TYPES = ['AADHAAR', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENCE'] as const;
export const ID_TYPE_LABEL: Record<string, string> = {
  AADHAAR: 'Aadhaar (masked Aadhaar is fine)', PASSPORT: 'Passport', VOTER_ID: 'Voter ID (EPIC)', DRIVING_LICENCE: 'Driving licence',
};

/** Reads and validates a mandatory government-ID image from multipart form data. */
export async function readIdUpload(form: FormData, forUserId?: string) {
  const file = form.get('idImage');
  if (!(file instanceof File) || file.size === 0) throw bad('A photo of your government ID is required (Aadhaar, passport, voter ID or driving licence).', 'ID_IMAGE_REQUIRED');
  const idType = String(form.get('idType') ?? '');
  if (!(ID_TYPES as readonly string[]).includes(idType)) throw bad('Choose which government ID you are uploading', 'ID_TYPE_REQUIRED');
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateIdImage(buf);
  if (!v.ok) throw bad(v.error, 'ID_IMAGE_INVALID');
  const hash = createHash('sha256').update(buf).digest('hex');
  const dup = await db.user.findFirst({ where: { idDocHash: hash, ...(forUserId ? { id: { not: forUserId } } : {}), idCardStatus: { in: ['PENDING', 'VERIFIED'] } }, select: { id: true } });
  if (dup) throw conflict('This ID image has already been used for another account.', 'ID_DUPLICATE');
  return { idType, buf, hash, info: v.info };
}

export function idDocumentCreate(u: { buf: Buffer; info: { mime: string; width: number; height: number } }): Prisma.IdDocumentCreateWithoutUserInput {
  return { mime: u.info.mime, width: u.info.width, height: u.info.height, data: u.buf };
}
