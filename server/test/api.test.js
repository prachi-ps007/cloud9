// Run with: npm test   (uses Node's built-in test runner, no extra packages)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

let B = '';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cloud9-test-'));
let server;
let token;

const call = async (method, url, { body, auth = true, form, raw } = {}) => {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(B + url, { method, headers, body: body ? JSON.stringify(body) : form });
  if (raw) return res;
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json, text };
};

const upload = (name, content, folderId = '') => {
  const form = new FormData();
  form.append('files', new Blob([content]), name);
  return call('POST', `/files/upload${folderId ? `?folderId=${folderId}` : ''}`, { form });
};

// Ask the OS for a free port so the test never clashes with another program
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

before(async () => {
  const PORT = await getFreePort();
  B = `http://127.0.0.1:${PORT}/api`;
  let output = '';
  let exited = null;

  server = spawn(process.execPath, ['src/index.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DB_PATH: path.join(tmp, 'db.sqlite'),
      STORAGE_DIR: path.join(tmp, 'storage'),
      ALLOW_REGISTRATION: 'false',
      DEMO_SEED: 'false',
      PUBLIC_URL: '',
      DEFAULT_STORAGE_LIMIT_GB: '10',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));
  server.on('exit', (code) => (exited = code));

  for (let i = 0; i < 100; i++) {
    if (exited !== null) break;
    try { if ((await fetch(`${B}/health`)).ok) return; } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server did not start (exit code: ${exited})\n--- server output ---\n${output || '(none)'}`);
});

after(async () => {
  // Windows keeps the SQLite file locked until the server process has really exited
  if (server && server.exitCode === null) {
    const closed = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await Promise.race([closed, new Promise((r) => setTimeout(r, 3000))]);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {
    /* leftover temp files are harmless - never fail the run because of cleanup */
  }
});

test('first user becomes owner, second registration is closed', async () => {
  const r = await call('POST', '/auth/register', { auth: false, body: { username: 'owner', password: 'password123' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.user.role, 'owner');
  token = r.json.token;
  const r2 = await call('POST', '/auth/register', { auth: false, body: { username: 'other', password: 'password123' } });
  assert.equal(r2.status, 403);
});

test('rejects bad passwords and unauthenticated requests', async () => {
  const bad = await call('POST', '/auth/login', { auth: false, body: { username: 'owner', password: 'wrong' } });
  assert.equal(bad.status, 401);
  const noAuth = await call('GET', '/files/browse', { auth: false });
  assert.equal(noAuth.status, 401);
  const short = await call('POST', '/auth/register', { auth: false, body: { username: 'x', password: '1' } });
  assert.equal(short.status, 400);
});

test('folders: create, duplicate blocked, cannot move into itself', async () => {
  const a = await call('POST', '/folders', { body: { name: 'Docs' } });
  assert.equal(a.status, 201);
  const dup = await call('POST', '/folders', { body: { name: 'docs' } });
  assert.equal(dup.status, 409);
  const child = await call('POST', '/folders', { body: { name: 'Sub', parentId: a.json.folder.id } });
  const loop = await call('PATCH', `/folders/${a.json.folder.id}`, { body: { parentId: child.json.folder.id } });
  assert.equal(loop.status, 400);
});

test('upload, auto-rename duplicates, download, delete', async () => {
  const u1 = await upload('note.txt', 'hello');
  assert.equal(u1.status, 201);
  const u2 = await upload('note.txt', 'hello again');
  assert.equal(u2.json.files[0].name, 'note (1).txt');
  const id = u1.json.files[0].id;
  const dl = await call('GET', `/files/${id}/download`, { raw: true });
  assert.equal(await dl.text(), 'hello');
  const del = await call('DELETE', `/files/${id}`);
  assert.equal(del.status, 200);
  assert.equal((await call('GET', `/files/${id}/download`)).status, 404);
});

test('storage limit is enforced', async () => {
  const set = await call('PUT', '/storage/limit', { body: { limitGB: 0.000001 } }); // ~1 KB
  assert.equal(set.status, 200);
  const big = await upload('big.bin', Buffer.alloc(50_000));
  assert.ok([413, 507].includes(big.status), `got ${big.status}`);
  const reset = await call('PUT', '/storage/limit', { body: { limitGB: 1 } });
  assert.equal(reset.status, 200);
});

test('share link: public download, expiry validation, revoke', async () => {
  const up = await upload('shared.txt', 'secret stuff');
  const fileId = up.json.files[0].id;
  const link = await call('POST', `/share/files/${fileId}`, { body: { expiresInHours: 2 } });
  assert.equal(link.status, 201);
  const t = link.json.link.token;

  const info = await call('GET', `/share/${t}/info`, { auth: false });
  assert.equal(info.json.name, 'shared.txt');
  const dl = await call('GET', `/share/${t}/download`, { auth: false, raw: true });
  assert.equal(await dl.text(), 'secret stuff');

  const bad = await call('POST', `/share/files/${fileId}`, { body: { expiresInHours: 99999 } });
  assert.equal(bad.status, 400);

  await call('DELETE', `/share/${link.json.link.id}`);
  assert.equal((await call('GET', `/share/${t}/info`, { auth: false })).status, 404);
});

test('QR pairing: one-time use, phone gets its own session', async () => {
  const p = await call('POST', '/pairing/create');
  assert.equal(p.status, 201);
  assert.match(p.json.qrDataUrl, /^data:image\/png;base64,/);
  const claim = await call('POST', '/pairing/claim', { auth: false, body: { code: p.json.code, deviceName: 'Test phone' } });
  assert.equal(claim.status, 200);
  const again = await call('POST', '/pairing/claim', { auth: false, body: { code: p.json.code } });
  assert.equal(again.status, 400);
  const me = await fetch(`${B}/auth/me`, { headers: { Authorization: `Bearer ${claim.json.token}` } });
  assert.equal(me.status, 200);
  const status = await call('GET', `/pairing/${p.json.code}/status`);
  assert.equal(status.json.status, 'claimed');
});

test('deleting a folder removes its files', async () => {
  const f = await call('POST', '/folders', { body: { name: 'Temp' } });
  const fid = f.json.folder.id;
  await upload('a.txt', 'a', fid);
  await upload('b.txt', 'b', fid);
  const del = await call('DELETE', `/folders/${fid}`);
  assert.equal(del.json.deletedFiles, 2);
});