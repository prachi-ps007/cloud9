import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const fromRoot = (p) => (path.isAbsolute(p) ? p : path.resolve(ROOT, p));

export const GB = 1024 ** 3;

export const config = {
  root: ROOT,
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',
  dbPath: fromRoot(process.env.DB_PATH || './data/cloud9.db'),
  storageDir: fromRoot(process.env.STORAGE_DIR || './storage'),
  defaultLimitBytes: Math.round((Number(process.env.DEFAULT_STORAGE_LIMIT_GB) || 10) * GB),
  sessionDays: Number(process.env.SESSION_DAYS) || 30,
  allowRegistration: process.env.ALLOW_REGISTRATION === 'true',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  clientDist: fromRoot(process.env.CLIENT_DIST || '../client/dist'),
};
