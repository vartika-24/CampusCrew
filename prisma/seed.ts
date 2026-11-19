import { db } from '../src/lib/db';
import { isDemoMode } from '../src/lib/config';
import { ensureSeeded, runSeed, wipe } from '../src/lib/seed';

async function main() {
  if (process.argv.includes('--force')) {
    if (!isDemoMode()) { console.error('Refusing to wipe the database: set DEMO_MODE=true (this resets to SAMPLE data and is for demos only).'); process.exit(1); }
    await wipe();
    await runSeed();
    console.log('✓ Database reset and re-seeded.');
  } else if (await ensureSeeded()) {
    console.log('✓ Database seeded with IIIT Allahabad demo data.');
  } else {
    console.log('• Nothing to seed (DEMO_MODE is not "true" or the database already has data). Use `npm run db:reset` for a fresh demo database.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
