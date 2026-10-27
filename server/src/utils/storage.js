import fs from 'node:fs';
import path from 'node:path';
import db, { getSetting } from '../db.js';
import { config } from '../config.js';

export const tmpDir = path.join(config.storageDir, 'tmp');
export const filesDir = path.join(config.storageDir, 'files');

export function ensureStorageDirs() {
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(filesDir, { recursive: true });
}

// Remove leftovers from interrupted uploads
export function cleanTmpDir() {
  for (const f of fs.readdirSync(tmpDir)) {
    fs.rmSync(path.join(tmpDir, f), { force: true });
  }
}

export const userDir = (userId) => path.join(filesDir, String(userId));

export function storedPath(userId, storedName) {
  return path.join(userDir(userId), storedName);
}

export function safeUnlink(p) {
  try {
    fs.rmSync(p, { force: true });
  } catch {
    /* ignore */
  }
}

export function getUsedBytes(userId = null) {
  const row = userId
    ? db.prepare('SELECT COALESCE(SUM(size),0) AS n FROM files WHERE user_id = ?').get(userId)
    : db.prepare('SELECT COALESCE(SUM(size),0) AS n FROM files').get();
  return row.n;
}

export function getLimitBytes() {
  const v = getSetting('storage_limit_bytes');
  return v ? Number(v) : config.defaultLimitBytes;
}

// Free / total space on the drive that holds the storage folder (null if unsupported)
export function getDiskInfo() {
  try {
    const s = fs.statfsSync(config.storageDir);
    return { totalBytes: s.bsize * s.blocks, freeBytes: s.bsize * s.bavail };
  } catch {
    return null;
  }
}
