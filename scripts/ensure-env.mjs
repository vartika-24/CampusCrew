// Creates .env from .env.example when missing so `npm run setup` works out-of-the-box.
import { existsSync, copyFileSync } from 'node:fs';
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example');
}
