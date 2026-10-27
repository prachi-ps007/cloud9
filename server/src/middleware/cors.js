import { config } from '../config.js';

// Minimal CORS (auth uses Bearer tokens, not cookies)
export function cors(req, res, next) {
  const allowed = config.corsOrigin.split(',').map((s) => s.trim());
  const origin = req.headers.origin;

  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
