import { spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const site = process.argv[2] || 'default';
const envFile = path.join(__dirname, '..', `.env.${site}`);

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile });
  console.log(`Loaded environment from ${envFile}`);
} else {
  console.warn(`Warning: ${envFile} not found. Using default .env`);
  dotenv.config();
}

const nextBuild = spawn('next', ['build'], {
  stdio: 'inherit',
  env: process.env,
});

nextBuild.on('error', (err) => {
  console.error('Failed to start Next.js build:', err);
});

nextBuild.on('close', (code) => {
  console.log(`Next.js build exited with code ${code}`);
});
