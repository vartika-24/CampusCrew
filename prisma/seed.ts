import { db } from '../src/lib/db';
import { ensureSeeded, runSeed, wipe } from '../src/lib/seed';

async function main() {
  if (process.argv.includes('--force')) {
    await wipe();
    await runSeed();
    console.log('✓ Database reset and re-seeded.');
  } else if (await ensureSeeded()) {
    console.log('✓ Database seeded with IIIT Allahabad demo data.');
  } else {
    console.log('• Database already seeded — skipping (use `npm run db:reset` to start over).');
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
