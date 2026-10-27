import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import db from './db.js';
import { cors } from './middleware/cors.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import folderRoutes from './routes/folders.js';
import fileRoutes from './routes/files.js';
import storageRoutes from './routes/storage.js';
import pairingRoutes from './routes/pairing.js';
import shareRoutes from './routes/share.js';
import { cleanTmpDir, ensureStorageDirs } from './utils/storage.js';
import { getLanIPs } from './utils/network.js';
import { seedDemo } from './seed.js';

ensureStorageDirs();
cleanTmpDir();
await seedDemo();

const app = express();
// Behind a cloud proxy (Railway, Render, Cloudflare...) this makes req.ip and req.protocol the real client's
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors);
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, name: 'cloud9', time: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/pairing', pairingRoutes);
app.use('/api/share', shareRoutes);

// In production serve the built React app (client/dist) from the same server
const indexHtml = path.join(config.clientDist, 'index.html');
if (fs.existsSync(indexHtml)) {
  app.use(express.static(config.clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

app.use(notFound);
app.use(errorHandler);

// Housekeeping: drop expired sessions every hour
setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}, 60 * 60 * 1000).unref();

const server = app.listen(config.port, config.host, () => {
  console.log(`\n  Cloud9 server running`);
  console.log(`  Local:   http://localhost:${config.port}`);
  for (const ip of getLanIPs()) console.log(`  Network: http://${ip}:${config.port}`);
  console.log(`  Storage: ${config.storageDir}\n`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
