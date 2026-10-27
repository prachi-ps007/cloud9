// Demo seeding for hosts with an ephemeral disk (e.g. Render free tier).
// If DEMO_SEED=true and the database has no users, create a demo owner account with sample files,
// so evaluators always find a populated app even after the host wipes the disk.
import crypto from 'node:crypto';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { storedPath, userDir } from './utils/storage.js';

const CLOUD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120" width="400" height="240">
<rect width="200" height="120" fill="#eef2ff"/>
<path d="M60 85a22 22 0 0 1 4-43 30 30 0 0 1 58-6 26 26 0 0 1 8 49z" fill="#6366f1"/>
<text x="100" y="108" font-family="sans-serif" font-size="11" text-anchor="middle" fill="#4338ca">Cloud9</text></svg>`;

const WELCOME = `Welcome to Cloud9!

This is a demo instance. Things to try:
  - Upload a file (button or drag-and-drop) and open its preview
  - Create folders, rename and move items
  - Share a file with an expiring link, then open the link in a private window
  - Connect a phone with the QR code (Devices page)
  - Storage page: see usage and, as the owner, change the allocation

Note: this demo runs on a free host whose disk is wiped when it restarts, so data resets now and then.
A real Cloud9 install on your own machine keeps everything on its disk.
`;

const OVERVIEW = `# Cloud9 overview

Cloud9 turns any machine into a private cloud:
- files live on the host's own disk, metadata in SQLite
- the owner decides how much disk space Cloud9 may use
- phones join by scanning a QR code (no password typing)
- every logged-in device can be revoked instantly
`;

export async function seedDemo() {
  if (process.env.DEMO_SEED !== 'true') return;
  const username = process.env.DEMO_USERNAME || 'demo';
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    console.warn('DEMO_SEED skipped: set DEMO_PASSWORD (at least 8 characters)');
    return;
  }
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;

  const hash = await bcrypt.hash(password, 10);
  const now = Date.now();
  const userId = Number(
    db
      .prepare("INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'owner', ?)")
      .run(username, hash, now).lastInsertRowid
  );

  const folder = (name, parentId) =>
    Number(
      db
        .prepare('INSERT INTO folders (user_id, parent_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, parentId, name, now, now).lastInsertRowid
    );

  fs.mkdirSync(userDir(userId), { recursive: true });
  const file = (folderId, name, mime, content) => {
    const buf = Buffer.from(content);
    const stored = crypto.randomUUID();
    fs.writeFileSync(storedPath(userId, stored), buf);
    db.prepare(
      `INSERT INTO files (user_id, folder_id, name, stored_name, mime_type, size, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(userId, folderId, name, stored, mime, buf.length, now, now);
  };

  const docs = folder('Documents', null);
  const photos = folder('Photos', null);
  const projects = folder('Projects', docs);
  file(null, 'Welcome.txt', 'text/plain', WELCOME);
  file(docs, 'Cloud9-overview.md', 'text/markdown', OVERVIEW);
  file(projects, 'todo.txt', 'text/plain', '1. Try sharing a file\n2. Pair a phone\n3. Check the Storage page\n');
  file(photos, 'cloud.svg', 'image/svg+xml', CLOUD_SVG);

  console.log(`Demo account created: ${username} (sample files added)`);
}
