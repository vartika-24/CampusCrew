import { db } from '@/lib/db';
import { bad, forbidden, handle, ok } from '@/lib/api';
import { publicUser, requireUser } from '@/lib/auth';
import { GENDERS } from '@/lib/constants';
import { idDocumentCreate, readIdUpload } from '@/lib/idverify';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Re-submit a government ID (after a rejection, or to replace a pending one). Verified users cannot change it. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  if (user.role === 'ADMIN') throw forbidden('Admins do not need ID verification');
  if (user.idCardStatus === 'VERIFIED') throw forbidden('Your identity is already verified and locked.', 'ALREADY_VERIFIED');
  let form: FormData;
  try { form = await req.formData(); } catch { throw bad('Send the ID as multipart form data'); }
  const id = await readIdUpload(form, user.id);
  const data: Record<string, unknown> = { idCardStatus: 'PENDING', idType: id.idType, idDocHash: id.hash, idSubmittedAt: new Date(), idRejectReason: null };
  const gender = String(form.get('gender') ?? '').trim();
  if (gender) { if (!(GENDERS as readonly string[]).includes(gender)) throw bad('Invalid gender'); data.gender = gender; }
  const name = String(form.get('name') ?? '').trim();
  if (name) { if (name.length < 2 || name.length > 60) throw bad('Enter your full name exactly as on your ID'); data.name = name; }
  await db.idDocument.deleteMany({ where: { userId: user.id } });
  const updated = await db.user.update({ where: { id: user.id }, data: { ...data, idDocuments: { create: idDocumentCreate(id) } } });
  const admins = await db.user.findMany({ where: { role: 'ADMIN', suspended: false }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'INFO', 'ID re-submitted', `${updated.name} uploaded a new ID for review.`, '/admin?tab=verification')));
  return ok({ user: publicUser(updated) });
});
