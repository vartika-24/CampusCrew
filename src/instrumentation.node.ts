import { ensureSeeded } from '@/lib/seed';

try {
  if (await ensureSeeded()) console.log('[campuscrew] Empty database detected — seeded IIIT Allahabad demo data.');
} catch (e) {
  console.warn('[campuscrew] Auto-seed skipped (run `npm run setup` to create the database):', (e as Error).message);
}
