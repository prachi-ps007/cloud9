import crypto from 'node:crypto';
import db from '../db.js';
import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

const DAY = 24 * 60 * 60 * 1000;

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createSession(userId, deviceName = 'Unknown device') {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO sessions (user_id, token_hash, device_name, created_at, last_used_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(userId, hashToken(token), deviceName.slice(0, 100), now, now, now + config.sessionDays * DAY);
  return { token, sessionId: Number(info.lastInsertRowid), expiresAt: now + config.sessionDays * DAY };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  let token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  // Allow ?token= on GET so <img src>, <a href download> and video tags work
  if (!token && req.method === 'GET' && typeof req.query.token === 'string') {
    token = req.query.token;
  }
  if (!token) return next(new AppError(401, 'Not authenticated'));

  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.expires_at, u.id, u.username, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(hashToken(token));

  if (!row || row.expires_at < Date.now()) {
    return next(new AppError(401, 'Session expired or invalid'));
  }

  db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(Date.now(), row.session_id);
  req.user = { id: row.id, username: row.username, role: row.role };
  req.sessionId = row.session_id;
  next();
}

export function requireOwner(req, res, next) {
  if (req.user?.role !== 'owner') return next(new AppError(403, 'Only the owner can do this'));
  next();
}
