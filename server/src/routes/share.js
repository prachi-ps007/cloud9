import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { z } from 'zod';
import db from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { idSchema } from '../utils/schemas.js';
import { requireFile } from '../utils/fsItems.js';
import { storedPath } from '../utils/storage.js';
import { baseUrl } from '../utils/network.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = Router();
const HOUR = 60 * 60 * 1000;

const mapLink = (r, req) => ({
  id: r.id,
  token: r.token,
  fileId: r.file_id,
  fileName: r.file_name,
  url: `${baseUrl(req)}/s/${r.token}`,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  expired: r.expires_at < Date.now(),
  downloadCount: r.download_count,
});

// ---------- Owner side (auth required) ----------

// Create a link for a file. Body: { expiresInHours?: 1..720 (default 24) }
router.post(
  '/files/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = requireFile(req.user.id, idSchema.parse(req.params.id));
    const { expiresInHours } = z
      .object({ expiresInHours: z.number().min(1).max(720).default(24) })
      .parse(req.body ?? {});

    const token = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    const info = db
      .prepare(
        'INSERT INTO share_links (token, file_id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(token, file.id, req.user.id, now, now + expiresInHours * HOUR);

    const row = db
      .prepare(
        `SELECT l.*, f.name AS file_name FROM share_links l JOIN files f ON f.id = l.file_id WHERE l.id = ?`
      )
      .get(info.lastInsertRowid);
    res.status(201).json({ link: mapLink(row, req) });
  })
);

// All of my links
router.get('/', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT l.*, f.name AS file_name FROM share_links l JOIN files f ON f.id = l.file_id
       WHERE l.user_id = ? AND f.deleted_at IS NULL ORDER BY l.created_at DESC`
    )
    .all(req.user.id);
  res.json({ links: rows.map((r) => mapLink(r, req)) });
});

// Revoke
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const info = db.prepare('DELETE FROM share_links WHERE id = ? AND user_id = ?').run(id, req.user.id);
    if (!info.changes) throw new AppError(404, 'Link not found');
    res.json({ ok: true });
  })
);

// ---------- Public side (no login, link holder only) ----------
const publicLimiter = rateLimit({ max: 120 });

function findValidLink(token) {
  const row = db
    .prepare(
      `SELECT l.*, f.name, f.size, f.mime_type, f.stored_name
       FROM share_links l JOIN files f ON f.id = l.file_id WHERE l.token = ? AND f.deleted_at IS NULL`
    )
    .get(token);
  if (!row) throw new AppError(404, 'This link does not exist or was revoked');
  if (row.expires_at < Date.now()) throw new AppError(410, 'This link has expired');
  return row;
}

router.get(
  '/:token/info',
  publicLimiter,
  asyncHandler(async (req, res) => {
    const l = findValidLink(req.params.token);
    res.json({ name: l.name, size: l.size, mimeType: l.mime_type, expiresAt: l.expires_at });
  })
);

router.get(
  '/:token/download',
  publicLimiter,
  asyncHandler(async (req, res) => {
    const l = findValidLink(req.params.token);
    const p = storedPath(l.user_id, l.stored_name);
    if (!fs.existsSync(p)) throw new AppError(410, 'File data is missing on disk');
    db.prepare('UPDATE share_links SET download_count = download_count + 1 WHERE id = ?').run(l.id);
    res.setHeader('Content-Type', l.mime_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(p, l.name);
  })
);

export default router;
