import { db } from '@/lib/db';
import { bad, forbidden, handle, ok } from '@/lib/api';
import { publicUser, requireUser } from '@/lib/auth';
import { verifyIdUpload } from '@/lib/idverify';
import { recomputeTrust } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

/** Verify an unverified account (e.g. created before ID checks). Verified accounts are locked. */
export const POST = handle(async (req) => {
  const user = await requireUser();
  if (user.role === 'ADMIN') throw forbidden('Admins do not need ID verification');
  if (user.idCardStatus === 'VERIFIED') throw forbidden('Your identity is already verified and locked.', 'ALREADY_VERIFIED');
  let form: FormData;
  try { form = await req.formData(); } catch { throw bad('Send the ID as multipart form data'); }
  const name = String(form.get('name') ?? '').trim() || user.name;
  const id = await verifyIdUpload(req, form, { name, email: user.email, forUserId: user.id });
  const updated = await db.user.update({ where: { id: user.id }, data: { name, gender: id.gender, genderLocked: true, idCardStatus: 'VERIFIED', idType: id.idType, idDocHash: id.hash, idSubmittedAt: new Date() } });
  await recomputeTrust(user.id);
  return ok({ user: publicUser(updated) });
});
