import { ensureSeeded } from '@/lib/seed';
import { db } from '@/lib/db';
import { isDemoMode } from '@/lib/config';

try {
  const seeded = await ensureSeeded();
  if (seeded) console.log('[campuscrew] DEMO_MODE: empty database detected — seeded IIIT Allahabad demo data.');
  if (!isDemoMode()) {
    const demoUsers = await db.user.count({ where: { isDemo: true } });
    if (demoUsers > 0) console.warn(`[campuscrew] WARNING: ${demoUsers} demo account(s) exist in a non-demo deployment. Use a fresh database for production.`);
    if (!process.env.ADMIN_EMAILS) console.warn('[campuscrew] ADMIN_EMAILS is not set: nobody can approve student IDs. Set it to the Student Affairs email(s).');
    if (!process.env.EMAIL_PROVIDER || !process.env.EMAIL_API_KEY) console.warn('[campuscrew] Email delivery is not configured (EMAIL_PROVIDER / EMAIL_API_KEY): OTP login will be unavailable.');
  }
} catch (e) {
  console.warn('[campuscrew] Startup check skipped (run `npm run setup` to create the database):', (e as Error).message);
}
