# Cloud9 - client

React + Vite + Tailwind CSS v4 + React Router + Lucide.

## Run (development)
1. Start the server first (`cd ../server && npm run dev`, port 4000)
2. In this folder:
```bash
npm install
npm run dev        # http://localhost:5173
```
Vite forwards every /api request to the server (see vite.config.js), so there is no CORS setup and
no API URL to configure.

## Testing phone pairing in development
1. Find the laptop's Wi-Fi IPv4 address with `ipconfig`
2. In server/.env set `PUBLIC_URL=http://<that-ip>:5173` and restart the server
3. Open http://localhost:5173 on the laptop, log in, press "Connect phone", scan the QR code with the phone
(the phone must be on the same Wi-Fi; allow Node.js through Windows Firewall if asked)

## Production build
```bash
npm run build      # creates client/dist
```
The Express server automatically serves ../client/dist, so one process (port 4000) hosts both the API and
the app. In that mode leave PUBLIC_URL empty - the QR code will use http://<laptop-ip>:4000.

## Pages
| Route | Page |
| --- | --- |
| /login | Sign in / first-time owner account |
| / and /folder/:id | File browser: upload (button or drag-and-drop), folders, rename, move, delete, preview, share, search |
| /shared | Your share links: copy, revoke, download counts |
| /devices | Logged-in browsers and phones, remove a device, connect phone (QR) |
| /storage | Usage, real disk space, owner sets the allocation |
| /pair?code= | Opened by the phone after scanning the QR code |
| /s/:token | Public download page for a share link (no login) |
