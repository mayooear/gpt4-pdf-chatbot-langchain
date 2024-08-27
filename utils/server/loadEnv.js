import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

export function loadEnv(optionalSiteId) {
  const site = optionalSiteId || process.env.SITE_ID || 'default';
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.join(__dirname, '..', '..');
  const envFile = path.join(rootDir, `.env.${site}`);

  dotenv.config({ path: envFile });
  console.log(`Loaded environment from ${envFile}`);
}
