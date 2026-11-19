// Creates .env for local development when missing: demo mode ON, direct college-email sign-in, no ID step.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
if (!existsSync('.env')) {
  const base = readFileSync('.env.example', 'utf8')
    .replace('DEMO_MODE="false"', 'DEMO_MODE="true"').replace('AUTH_MODE="otp"', 'AUTH_MODE="instant"').replace('REQUIRE_GOV_ID="true"', 'REQUIRE_GOV_ID="false"');
  writeFileSync('.env', base);
  console.log('Created .env for local development (DEMO_MODE, AUTH_MODE=instant, REQUIRE_GOV_ID=false). Review it before deploying.');
}
