import { db } from '@/lib/db';
import { bad, conflict, handle, ok, oneOf, readJson, str } from '@/lib/api';
import { publicUser, setSessionCookie, verifySignupToken } from '@/lib/auth';
import { DEPARTMENTS, GENDERS, HOSTELS, ROLL_REGEX } from '@/lib/constants';
import { computeTrust } from '@/lib/safety/trust';
import { verifyStudentId, yearFromRoll } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req) => {
  const body = await readJson(req);
  const email = await verifySignupToken(str(body.signupToken, 'signupToken'));
  if (await db.user.findUnique({ where: { email } })) throw conflict('An account already exists for this email. Sign in instead.');

  const name = str(body.name, 'Full name', { min: 2, max: 60 });
  const rollNumber = str(body.rollNumber, 'Roll number', { max: 20 }).toUpperCase();
  if (!ROLL_REGEX.test(rollNumber)) throw bad('Roll number looks like IEC2024123 (3 letters + 7 digits)', 'BAD_ROLL');
  if (await db.user.findUnique({ where: { rollNumber } })) throw conflict('This roll number is already registered', 'ROLL_TAKEN');
  const department = str(body.department, 'Department', { max: 40 });
  if (!(DEPARTMENTS as readonly string[]).includes(department)) throw bad('Pick a department from the list');
  const hostel = oneOf(body.hostel, 'Hostel', HOSTELS);
  const gender = oneOf(body.gender, 'Gender', GENDERS);
  if (body.confirmGenderLock !== true) throw bad('Please confirm that gender is locked after verification', 'GENDER_LOCK_UNCONFIRMED');
  const upiId = str(body.upiId, 'UPI ID', { optional: true, max: 60 });
  if (upiId && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(upiId)) throw bad('UPI ID looks like name@bank');

  let idCardImage: string | null = null;
  if (body.idCardImage) {
    const img = str(body.idCardImage, 'ID card image');
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(img)) throw bad('ID card must be a PNG, JPG or WebP image');
    if (img.length > 1_800_000) throw bad('ID card image is too large (max ~1.3 MB)');
    idCardImage = img;
  }

  const check = verifyStudentId(rollNumber);
  if (!check.ok) throw bad('Student ID could not be verified. Check your roll number.', 'ID_UNVERIFIED', { steps: check.steps });

  const trustScore = computeTrust({ verified: true, completedRides: 0, ratingSum: 0, ratingCount: 0, punctualCount: 0, cancelCount: 0, lateCancels: 0, unresolvedReports: 0, adminAdjust: 0 });
  const user = await db.user.create({
    data: {
      email, name, rollNumber, department, hostel, gender, year: yearFromRoll(rollNumber), upiId: upiId || null,
      emailVerified: true, idCardStatus: 'VERIFIED', idCardImage, genderLocked: true, trustScore, lastLoginAt: new Date(),
    },
  });
  await db.notification.create({ data: { userId: user.id, kind: 'INFO', title: 'You are verified ✔', body: 'College email and Student ID verified. Gender is now locked on your profile.', link: '/profile' } });
  await setSessionCookie(user.id);
  return ok({ user: publicUser(user), verification: check.steps }, { status: 201 });
});
