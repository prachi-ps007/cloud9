import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import db from '../db.js';
import { config } from '../config.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { idSchema } from '../utils/schemas.js';
import { createSession, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const limiter = rateLimit({ max: 30 });

const credentials = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, _ . -'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  deviceName: z.string().trim().max(100).optional(),
});

const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });

router.post(
  '/register',
  limiter,
  asyncHandler(async (req, res) => {
    const { username, password, deviceName } = credentials.parse(req.body);

    const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    const isFirst = count === 0;
    if (!isFirst && !config.allowRegistration) {
      throw new AppError(403, 'Registration is closed. Ask the owner to enable it.');
    }
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
      throw new AppError(409, 'Username already taken');
    }

    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare('INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)')
      .run(username, hash, isFirst ? 'owner' : 'member', Date.now());

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const session = createSession(user.id, deviceName || 'Web browser');
    res.status(201).json({ user: publicUser(user), token: session.token, expiresAt: session.expiresAt });
  })
);

router.post(
  '/login',
  limiter,
  asyncHandler(async (req, res) => {
    const { username, password, deviceName } = credentials
      .pick({ username: true, deviceName: true })
      .extend({ password: z.string().min(1).max(128) })
      .parse(req.body);

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) throw new AppError(401, 'Invalid username or password');

    const session = createSession(user.id, deviceName || 'Web browser');
    res.json({ user: publicUser(user), token: session.token, expiresAt: session.expiresAt });
  })
);

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Whether the register page should be shown (no auth needed)
router.get('/status', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  res.json({ hasUsers: count > 0, registrationOpen: count === 0 || config.allowRegistration });
});

// Logged-in devices (browsers + paired phones)
router.get('/devices', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, device_name, created_at, last_used_at, expires_at
       FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY last_used_at DESC`
    )
    .all(req.user.id, Date.now());
  res.json({
    devices: rows.map((r) => ({
      id: r.id,
      name: r.device_name,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      current: r.id === req.sessionId,
    })),
  });
});

router.delete(
  '/devices/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const info = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, req.user.id);
    if (!info.changes) throw new AppError(404, 'Device not found');
    res.json({ ok: true });
  })
);

export default router;
