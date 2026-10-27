import { Router } from 'express';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { z } from 'zod';
import db from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { baseUrl } from '../utils/network.js';
import { createSession, requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const CODE_TTL = 5 * 60 * 1000; // 5 minutes

// 1) Logged-in laptop browser asks for a QR code
router.post(
  '/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    const now = Date.now();
    db.prepare('DELETE FROM pairing_codes WHERE expires_at < ?').run(now - 60 * 60 * 1000);

    const code = crypto.randomBytes(24).toString('base64url');
    db.prepare(
      'INSERT INTO pairing_codes (code, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
    ).run(code, req.user.id, now, now + CODE_TTL);

    const url = `${baseUrl(req)}/pair?code=${code}`;
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
    res.status(201).json({ code, url, qrDataUrl, expiresAt: now + CODE_TTL });
  })
);

// 2) Laptop polls this to know when the phone has scanned
router.get(
  '/:code/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const row = db
      .prepare('SELECT * FROM pairing_codes WHERE code = ? AND user_id = ?')
      .get(req.params.code, req.user.id);
    if (!row) throw new AppError(404, 'Pairing code not found');
    const status = row.claimed_at ? 'claimed' : row.expires_at < Date.now() ? 'expired' : 'pending';
    res.json({ status, expiresAt: row.expires_at });
  })
);

// 3) Phone opens the QR link, the web app calls this with the code - no password needed
router.post(
  '/claim',
  rateLimit({ max: 20 }),
  asyncHandler(async (req, res) => {
    const { code, deviceName } = z
      .object({ code: z.string().min(10).max(100), deviceName: z.string().trim().max(100).optional() })
      .parse(req.body);

    const claim = db.transaction(() => {
      const row = db.prepare('SELECT * FROM pairing_codes WHERE code = ?').get(code);
      if (!row || row.claimed_at || row.expires_at < Date.now()) {
        throw new AppError(400, 'This QR code is invalid or has expired');
      }
      db.prepare('UPDATE pairing_codes SET claimed_at = ? WHERE code = ?').run(Date.now(), code);
      return row.user_id;
    });

    const userId = claim();
    const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(userId);
    const session = createSession(userId, deviceName || 'Paired phone');
    res.json({ user, token: session.token, expiresAt: session.expiresAt });
  })
);

export default router;
