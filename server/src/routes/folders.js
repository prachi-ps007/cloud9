import { Router } from 'express';
import { z } from 'zod';
import db from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { idSchema, nameSchema, nullableId } from '../utils/schemas.js';
import { folderNameTaken, mapFolder, requireFolder } from '../utils/fsItems.js';
import { safeUnlink, storedPath } from '../utils/storage.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, parentId = null } = z
      .object({ name: nameSchema, parentId: nullableId.optional() })
      .parse(req.body);

    if (parentId !== null) requireFolder(req.user.id, parentId);
    if (folderNameTaken(req.user.id, parentId, name)) {
      throw new AppError(409, 'A folder with this name already exists here');
    }

    const now = Date.now();
    const info = db
      .prepare(
        'INSERT INTO folders (user_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(req.user.id, parentId, name, now, now);
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ folder: mapFolder(folder) });
  })
);

// Rename and/or move
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const body = z
      .object({ name: nameSchema.optional(), parentId: nullableId.optional() })
      .refine((b) => b.name !== undefined || b.parentId !== undefined, 'Nothing to update')
      .parse(req.body);

    const folder = requireFolder(req.user.id, id);
    const name = body.name ?? folder.name;
    const parentId = body.parentId !== undefined ? body.parentId : folder.parent_id;

    if (parentId !== null) {
      requireFolder(req.user.id, parentId);
      // Can't move a folder into itself or one of its own subfolders
      const descendants = db
        .prepare(
          `WITH RECURSIVE tree(id) AS (
             SELECT id FROM folders WHERE id = ?
             UNION ALL
             SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
           ) SELECT id FROM tree`
        )
        .all(id)
        .map((r) => r.id);
      if (descendants.includes(parentId)) {
        throw new AppError(400, 'Cannot move a folder into itself');
      }
    }
    if (folderNameTaken(req.user.id, parentId, name, id)) {
      throw new AppError(409, 'A folder with this name already exists there');
    }

    db.prepare('UPDATE folders SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?').run(
      name,
      parentId,
      Date.now(),
      id
    );
    res.json({ folder: mapFolder(db.prepare('SELECT * FROM folders WHERE id = ?').get(id)) });
  })
);

// Deletes the folder, all subfolders and every file inside (database + disk)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    requireFolder(req.user.id, id);

    const files = db
      .prepare(
        `WITH RECURSIVE tree(id) AS (
           SELECT id FROM folders WHERE id = ?
           UNION ALL
           SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
         ) SELECT stored_name FROM files WHERE folder_id IN (SELECT id FROM tree)`
      )
      .all(id);

    db.prepare('DELETE FROM folders WHERE id = ?').run(id); // cascades to subfolders + file rows
    for (const f of files) safeUnlink(storedPath(req.user.id, f.stored_name));

    res.json({ ok: true, deletedFiles: files.length });
  })
);

export default router;
