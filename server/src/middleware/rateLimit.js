import { AppError } from '../utils/errors.js';

// Tiny in-memory limiter (per IP) - enough to slow down password guessing
export function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }, windowMs).unref();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      return next(new AppError(429, 'Too many attempts, try again later'));
    }
    next();
  };
}
