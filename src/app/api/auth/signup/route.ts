import { db } from '@/lib/db';
import { ApiError, bad, conflict } from '@/lib/api';
import { handle, ok } from '@/lib/api';
import { publicUser, setSessionCookie, verifySignupToken } from '@/lib/auth';
import { ROLL_REGEX } from '@/lib/constants';
import { verifyIdUpload } from '@/lib/idverify';
import { getConfig } from '@/lib/settings';
import { yearFromRoll } from '@/lib/validators';
import { notify } from '@/lib/notify';
import { computeTrust } from '@/lib/safety/trust';

export const dynamic = 'force-dynamic';

/**
 * Multipart signup with a MANDATORY government-ID photo. The ID is read automatically and the gender printed on it
 * becomes the (locked) gender of the account. The photo is discarded after reading.
 */
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
  if (f('confirmGenderLock') !== 'true') throw bad('Please confirm that the gender read from your ID is locked on your profile', 'GENDER_LOCK_UNCONFIRMED');
  const upiId = f('upiId');
  if (upiId && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upiId)) throw bad('UPI ID looks like name@bank');

  const id = await verifyIdUpload(req, form, { name, email }); // throws 400/409/422/429 with a helpful message

  const trustScore = computeTrust({ verified: true, completedRides: 0, ratingSum: 0, ratingCount: 0, punctualCount: 0, cancelCount: 0, lateCancels: 0, unresolvedReports: 0, adminAdjust: 0 });
  let user;
  try {
    user = await db.user.create({
      data: {
        email, name, rollNumber, department, hostel, gender: id.gender, year: yearFromRoll(rollNumber), upiId: upiId || null,
        emailVerified: true, idCardStatus: 'VERIFIED', genderLocked: true, idType: id.idType, idDocHash: id.hash, idSubmittedAt: new Date(),
        trustScore, lastLoginAt: new Date(),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') throw new ApiError(409, 'An account with these details already exists.', 'CONFLICT');
    throw e;
  }
  await notify(user.id, 'INFO', 'You are verified ✔', 'Your ID was read successfully and your gender is locked on your profile.', '/profile');
  await setSessionCookie(user.id);
  return ok({ user: publicUser(user), verified: true }, { status: 201 });
});
