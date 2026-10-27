import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import multer from 'multer';
import { z } from 'zod';
import db from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { idSchema, nameSchema, nullableId, parseFolderId } from '../utils/schemas.js';
import {
  fileNameTaken,
  getBreadcrumbs,
  mapFile,
  mapFolder,
  requireFile,
  requireFolder,
  uniqueFileName,
} from '../utils/fsItems.js';
import {
  getLimitBytes,
  getUsedBytes,
  safeUnlink,
  storedPath,
  tmpDir,
  userDir,
} from '../utils/storage.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ---------- Browse a folder (root when folderId is omitted) ----------
router.get(
  '/browse',
  asyncHandler(async (req, res) => {
    const folderId = parseFolderId(req.query.folderId);
    if (folderId !== null) requireFolder(req.user.id, folderId);

    const folders = db
      .prepare(
        'SELECT * FROM folders WHERE user_id = ? AND parent_id IS ? ORDER BY name COLLATE NOCASE'
      )
      .all(req.user.id, folderId);
    const files = db
      .prepare(
        'SELECT * FROM files WHERE user_id = ? AND folder_id IS ? ORDER BY name COLLATE NOCASE'
      )
      .all(req.user.id, folderId);

    res.json({
      folderId,
      breadcrumbs: getBreadcrumbs(req.user.id, folderId),
      folders: folders.map(mapFolder),
      files: files.map(mapFile),
    });
  })
);

// ---------- Search by name ----------
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const q = z.string().trim().min(1).max(100).parse(req.query.q);
    const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const files = db
      .prepare(
        `SELECT * FROM files WHERE user_id = ? AND name LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT 100`
      )
      .all(req.user.id, like);
    const folders = db
      .prepare(
        `SELECT * FROM folders WHERE user_id = ? AND name LIKE ? ESCAPE '\\'
         ORDER BY name COLLATE NOCASE LIMIT 100`
      )
      .all(req.user.id, like);
    res.json({ files: files.map(mapFile), folders: folders.map(mapFolder) });
  })
);

// ---------- Recent files ----------
router.get('/recent', (req, res) => {
  const files = db
    .prepare('SELECT * FROM files WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(req.user.id);
  res.json({ files: files.map(mapFile) });
});

// ---------- Upload (multipart field name: "files", folder via ?folderId=) ----------
router.post(
  '/upload',
  asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const folderId = parseFolderId(req.query.folderId);
    if (folderId !== null) requireFolder(userId, folderId);

    const remaining = getLimitBytes() - getUsedBytes();
    if (remaining <= 0) throw new AppError(507, 'Storage is full');

    const upload = multer({
      storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, tmpDir),
        filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
      }),
      limits: { fileSize: remaining, files: 100 },
    }).array('files', 100);

    await new Promise((resolve, reject) =>
      upload(req, res, (err) => (err ? reject(err) : resolve()))
    );

    const uploaded = req.files || [];
    const cleanup = () => uploaded.forEach((f) => safeUnlink(f.path));

    if (!uploaded.length) throw new AppError(400, 'No files received (use field name "files")');

    try {
      const dir = userDir(userId);
      fs.mkdirSync(dir, { recursive: true });
      const moved = [];

      const insert = db.transaction(() => {
        // Re-check quota inside the transaction so parallel uploads can't overshoot
        const total = uploaded.reduce((s, f) => s + f.size, 0);
        if (getUsedBytes() + total > getLimitBytes()) {
          throw new AppError(507, 'Not enough storage space allocated for these files');
        }

        const created = [];
        const now = Date.now();
        for (const f of uploaded) {
          // Browsers send UTF-8 names that multer reads as latin1 - fix that
          let original = f.originalname;
          if (!/[^\x00-\xff]/.test(original)) {
            original = Buffer.from(original, 'latin1').toString('utf8');
          }
          original = original.replace(/[\\/\0]/g, '_').trim().slice(0, 255) || 'file';

          const name = uniqueFileName(userId, folderId, original);
          const storedName = crypto.randomUUID();
          fs.renameSync(f.path, storedPath(userId, storedName));
          moved.push(storedPath(userId, storedName));

          const info = db
            .prepare(
              `INSERT INTO files (user_id, folder_id, name, stored_name, mime_type, size, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(userId, folderId, name, storedName, f.mimetype || 'application/octet-stream', f.size, now, now);
          created.push(db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid));
        }
        return created;
      });

      let created;
      try {
        created = insert();
      } catch (err) {
        moved.forEach(safeUnlink);
        throw err;
      }
      res.status(201).json({ files: created.map(mapFile) });
    } finally {
      cleanup(); // removes any temp file that wasn't moved
    }
  })
);

// ---------- Download / preview ----------
router.get(
  '/:id/download',
  asyncHandler(async (req, res) => {
    const file = requireFile(req.user.id, idSchema.parse(req.params.id));
    const p = storedPath(req.user.id, file.stored_name);
    if (!fs.existsSync(p)) throw new AppError(410, 'File data is missing on disk');
    res.setHeader('Content-Type', file.mime_type);
    res.download(p, file.name);
  })
);

router.get(
  '/:id/preview',
  asyncHandler(async (req, res) => {
    const file = requireFile(req.user.id, idSchema.parse(req.params.id));
    const p = storedPath(req.user.id, file.stored_name);
    if (!fs.existsSync(p)) throw new AppError(410, 'File data is missing on disk');

    // Inline display, but sandboxed so uploaded HTML/SVG can't run scripts against the app
    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', 'sandbox');
    res.sendFile(p); // supports Range requests (video/audio seeking)
  })
);

// ---------- Rename / move ----------
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = z
      .object({ name: nameSchema.optional(), folderId: nullableId.optional() })
      .refine((b) => b.name !== undefined || b.folderId !== undefined, 'Nothing to update')
      .parse(req.body);

    const file = requireFile(req.user.id, id);
    const name = body.name ?? file.name;
    const folderId = body.folderId !== undefined ? body.folderId : file.folder_id;

    if (folderId !== null) requireFolder(req.user.id, folderId);
    if (fileNameTaken(req.user.id, folderId, name, id)) {
      throw new AppError(409, 'A file with this name already exists there');
    }

    db.prepare('UPDATE files SET name = ?, folder_id = ?, updated_at = ? WHERE id = ?').run(
      name,
      folderId,
      Date.now(),
      id
    );
    res.json({ file: mapFile(db.prepare('SELECT * FROM files WHERE id = ?').get(id)) });
  })
);

// ---------- Delete ----------
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const file = requireFile(req.user.id, idSchema.parse(req.params.id));
    db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
    safeUnlink(storedPath(req.user.id, file.stored_name));
    res.json({ ok: true });
  })
);

export default router;
