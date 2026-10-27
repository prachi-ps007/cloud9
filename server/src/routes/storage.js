import { Router } from 'express';
import { z } from 'zod';
import { GB } from '../config.js';
import db, { setSetting } from '../db.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { getDiskInfo, getLimitBytes, getUsedBytes } from '../utils/storage.js';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function summary(userId) {
  const limitBytes = getLimitBytes();
  const usedBytes = getUsedBytes();
  return {
    limitBytes,
    usedBytes,
    availableBytes: Math.max(0, limitBytes - usedBytes),
    usedPercent: limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 1000) / 10) : 0,
    yourUsedBytes: getUsedBytes(userId),
    fileCount: db.prepare('SELECT COUNT(*) AS n FROM files').get().n,
    disk: getDiskInfo(), // real drive space: { totalBytes, freeBytes } or null
  };
}

router.get('/', (req, res) => {
  res.json(summary(req.user.id));
});

// Owner chooses how much of the laptop's drive the cloud may use
router.put(
  '/limit',
  requireOwner,
  asyncHandler(async (req, res) => {
    const { limitGB } = z
      .object({ limitGB: z.number().positive().max(100000) })
      .parse(req.body);

    const newLimit = Math.round(limitGB * GB);
    const used = getUsedBytes();
    if (newLimit < used) {
      throw new AppError(400, 'New limit is smaller than the space already used');
    }
    const disk = getDiskInfo();
    if (disk && newLimit > used + disk.freeBytes) {
      throw new AppError(400, 'Not enough free space on the laptop drive for that allocation');
    }

    setSetting('storage_limit_bytes', newLimit);
    res.json(summary(req.user.id));
  })
);

export default router;
