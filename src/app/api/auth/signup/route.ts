import { db } from '@/lib/db';
import { ApiError, bad, conflict } from '@/lib/api';
import { handle, ok } from '@/lib/api';
import { publicUser, setSessionCookie, verifySignupToken } from '@/lib/auth';
import { GENDERS, ROLL_REGEX } from '@/lib/constants';
import { idDocumentCreate, readIdUpload } from '@/lib/idverify';
import { getConfig } from '@/lib/settings';
import { yearFromRoll } from '@/lib/validators';
import { notify } from '@/lib/notify';

export const dynamic = 'force-dynamic';

/** Multipart signup: profile fields + MANDATORY government-ID image. The account stays "pending" until an admin approves the ID. */
export const POST = handle(async (req) => {
  let form: FormData;
  try { form = await req.formData(); } catch { throw bad('Send the signup as multipart form data'); }
  const f = (k: string) => String(form.get(k) ?? '').trim();

  const email = await verifySignupToken(f('signupToken'));
  if (await db.user.findUnique({ where: { email } })) throw conflict('An account already exists for this email. Sign in instead.');

  const name = f('name');
  if (name.length < 2 || name.length > 60) throw bad('Enter your full name exactly as on your ID (2–60 characters)');
  const rollNumber = f('rollNumber').toUpperCase();
  if (!ROLL_REGEX.test(rollNumber)) throw bad('Roll number looks like IEC2024123 (3 letters + 7 digits)', 'BAD_ROLL');
  if (await db.user.findUnique({ where: { rollNumber } })) throw conflict('This roll number is already registered', 'ROLL_TAKEN');
  const cfg = await getConfig();
  const department = f('department');
  if (!cfg.departments.includes(department)) throw bad('Pick a department from the list');
  const hostel = f('hostel');
  if (!cfg.hostels.includes(hostel)) throw bad('Pick a hostel from the list');
  const gender = f('gender');
  if (!(GENDERS as readonly string[]).includes(gender)) throw bad('Select the gender printed on your ID');
  if (f('confirmGenderLock') !== 'true') throw bad('Please confirm that gender is locked after verification', 'GENDER_LOCK_UNCONFIRMED');
  const upiId = f('upiId');
  if (upiId && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upiId)) throw bad('UPI ID looks like name@bank');

  const id = await readIdUpload(form); // throws if the image is missing / not a real image / too small / duplicate

  let user;
  try {
    user = await db.user.create({
      data: {
        email, name, rollNumber, department, hostel, gender, year: yearFromRoll(rollNumber), upiId: upiId || null,
        emailVerified: true, idCardStatus: 'PENDING', idType: id.idType, idDocHash: id.hash, idSubmittedAt: new Date(),
        genderLocked: false, trustScore: 0, lastLoginAt: new Date(),
        idDocuments: { create: idDocumentCreate(id) },
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new ApiError(409, 'An account with these details already exists.', 'CONFLICT');
    throw e;
  }
  await notify(user.id, 'INFO', 'ID submitted for review', 'Student Affairs will verify your ID and gender. You will be emailed once it is approved.', '/profile');
  const admins = await db.user.findMany({ where: { role: 'ADMIN', suspended: false }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'INFO', 'New ID to verify', `${name} (${rollNumber}) is waiting for ID review.`, '/admin?tab=verification')));
  await setSessionCookie(user.id);
  return ok({ user: publicUser(user), pendingReview: true }, { status: 201 });
});
