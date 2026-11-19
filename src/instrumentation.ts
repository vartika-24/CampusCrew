// Auto-seed the database on server start when it is empty (idempotent).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { ensureSeeded } = await import('@/lib/seed');
    if (await ensureSeeded()) console.log('[campuscrew] Empty database detected — seeded IIIT Allahabad demo data.');
  } catch (e) {
    console.warn('[campuscrew] Auto-seed skipped (run `npm run setup` to create the database):', (e as Error).message);
  }
}
