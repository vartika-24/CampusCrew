// Creates .env for local development when missing (demo mode ON so the app is instantly explorable).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (!existsSync('.env')) {
  const base = readFileSync('.env.example', 'utf8').replace('DEMO_MODE="false"', 'DEMO_MODE="true"');
  writeFileSync('.env', base);
  console.log('Created .env (DEMO_MODE=true for local development — set it to false and fill in the email/admin settings for production)');
}
