import { db } from '@/lib/db';
import { bad, conflict, handle, notFound, ok, oneOf, readJson, str } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { GENDERS } from '@/lib/constants';
import { emailConfigured, notice, sendEmail } from '@/lib/email';
import { notify } from '@/lib/notify';
import { recomputeTrust } from '@/lib/safety/guards';

export const dynamic = 'force-dynamic';

/**
 * Human review of a government ID. Approve: admin confirms name, photo and GENDER match the ID (and may correct the gender);
 * gender is then locked. Reject: reason required. The ID image is permanently deleted in both cases.
 */
export const POST = handle<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin();
  const body = await readJson(req);
  const action = oneOf(body.action, 'action', ['approve', 'reject'] as const);
  const u = await db.user.findUnique({ where: { id: params.id }, include: { idDocuments: { select: { id: true } } } });
  if (!u || u.role === 'ADMIN') throw notFound('Student not found');
  if (u.idCardStatus !== 'PENDING' || u.idDocuments.length === 0) throw conflict('This student has no ID waiting for review');

  let subject: string, text: string;
  if (action === 'approve') {
    if (body.confirmed !== true) throw bad('Confirm that the name, photo and gender on the ID match the profile', 'CONFIRM_REQUIRED');
    const gender = body.gender === undefined ? u.gender : oneOf(body.gender, 'gender', GENDERS);
    await db.user.update({ where: { id: u.id }, data: { idCardStatus: 'VERIFIED', gender, genderLocked: true, idReviewedById: admin.id, idReviewedAt: new Date(), idRejectReason: null } });
    await recomputeTrust(u.id);
    subject = 'Your CampusCrew account is verified';
    text = `Hi ${u.name.split(' ')[0]}, your ID has been verified. You can now plan trips and join crews on CampusCrew.\nYour gender is locked on your profile to keep gendered trips safe.`;
    await notify(u.id, 'INFO', 'You are verified ✔', 'Your ID was approved. You can now plan and join trips.', '/dashboard');
  } else {
    const reason = str(body.reason, 'Reason', { min: 5, max: 300 });
    await db.user.update({ where: { id: u.id }, data: { idCardStatus: 'REJECTED', idReviewedById: admin.id, idReviewedAt: new Date(), idRejectReason: reason } });
    subject = 'CampusCrew could not verify your ID';
    text = `Hi ${u.name.split(' ')[0]}, we could not verify your ID: ${reason}\nPlease sign in, open your profile and upload a clear photo of a valid government ID.`;
    await notify(u.id, 'PENALTY', 'ID not accepted', reason, '/profile');
  }
  await db.idDocument.deleteMany({ where: { userId: u.id } }); // data minimisation: the image is not kept after the decision
  if (emailConfigured()) await sendEmail({ to: u.email, ...notice(subject, text) }).catch((e) => console.error('[verify] notify email failed:', (e as Error).message));
  return ok({ ok: true });
});
