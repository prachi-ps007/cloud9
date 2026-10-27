import os from 'node:os';
import { config } from '../config.js';

export function getLanIPs() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) out.push(i.address);
    }
  }
  return out;
}

// Base URL that other devices (phones, share-link recipients) should open.
// 1) PUBLIC_URL if set  2) the address the request came in on (works behind a cloud proxy)
// 3) on a laptop opened via localhost, the LAN address so a phone can reach it
export function baseUrl(req) {
  if (config.publicUrl) return config.publicUrl;
  const host = req.get('host') || '';
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  if (!isLocal) return `${req.protocol}://${host}`;
  const ip = getLanIPs()[0];
  if (ip) return `http://${ip}:${config.port}`;
  return `${req.protocol}://${host}`;
}
