# CLOUD9 ☁️🌊
### Your personal cloud, with a calmer place for your files.

CLOUD9 is a full-stack personal cloud-storage web application built to make file organization, sharing, and device access simple. It combines a React interface with an Express API and SQLite metadata storage, while uploaded file contents are stored on the server's filesystem.

The project focuses on the essentials of a personal cloud: organize files into folders, upload and preview content, share files through time-limited links, connect a phone with a QR code, monitor storage usage, and manage active sessions from one place.

> **Project status:** Student full-stack project / end-term submission  
> **Deployment:** Designed to run as one Dockerized service and deployable to Render  
> **Important storage note:** On hosts with ephemeral filesystems (including a default Render web service), uploaded files and the SQLite database may not survive restarts or redeploys unless persistent storage is configured.

---

## Contents

- [Highlights](#-highlights)
- [Feature overview](#-feature-overview)
- [Tech stack](#-tech-stack)
- [How it works](#-how-it-works)
- [Project structure](#-project-structure)
- [Getting started locally](#-getting-started-locally)
- [Environment variables](#-environment-variables)
- [Run with Docker](#-run-with-docker)
- [Deploy to Render](#-deploy-to-render)
- [API overview](#-api-overview)
- [Security notes](#-security-notes)
- [Testing](#-testing)
- [Known limitations](#-known-limitations)
- [Future improvements](#-future-improvements)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Highlights

- **Personal file workspace:** Browse files and folders from a single dashboard.
- **File operations:** Upload, preview, download, rename, move, search, and delete files.
- **Folder organization:** Create nested folders and organize content around your workflow.
- **Trash & Recovery:** Deleted items can be managed through the Trash experience in versions that include the Trash & Recovery changes. Check the deployed version and current repository before relying on this behavior.
- **Shareable links:** Generate links for individual files, set an expiry, track downloads, and revoke links.
- **Phone pairing:** Pair a phone/browser using a QR code rather than entering credentials on the paired device.
- **Session management:** Review active sessions and revoke access for a device.
- **Storage dashboard:** View used space and the configured storage allocation.
- **Responsive, beach-inspired UI:** A calm visual style designed to work across desktop and mobile browser sizes.
- **Single-service production setup:** The Express server can serve the built React app and the API from the same origin.

## 🧩 Feature overview

| Feature | What it does |
| --- | --- |
| Authentication | Register the first owner account, sign in, and sign out |
| File browser | Browse the root directory and nested folders |
| Uploads | Upload one or more files into the current folder |
| Preview and download | Preview supported file types in the browser or download them |
| Search | Search files and folders by name |
| Folder management | Create, rename, move, and delete folders |
| File management | Rename and move files, and delete files |
| Sharing | Create time-limited file links, see existing links, and revoke links |
| Phone pairing | Generate a short-lived QR pairing code and create a phone session |
| Device management | List active sessions and revoke a selected session |
| Storage | View used storage and update the configured allocation |
| Trash & Recovery | Available in the repository version containing the Trash feature changes; verify the current branch/deployment to confirm its exact behavior |

## 🛠️ Tech stack

### Frontend
- **React 18** — component-based user interface
- **Vite** — local development server and production bundler
- **React Router** — client-side navigation
- **Tailwind CSS** — styling
- **Lucide React** — interface icons

### Backend
- **Node.js** — JavaScript runtime
- **Express 5** — HTTP server and REST API
- **SQLite** with **better-sqlite3** — users, sessions, folders, file metadata, storage settings, pairing codes, and share-link metadata
- **bcryptjs** — password hashing
- **Multer** — multipart file uploads
- **Zod** — request data validation
- **QRCode** — QR code generation
- **dotenv** — local environment configuration

### Deployment
- **Docker** — builds the React client and packages the API into one service
- **Render** — supported hosting option through the included `render.yaml`

## 🏗️ How it works

CLOUD9 separates file metadata from the actual file contents.

1. The React client sends API requests to the Express backend.
2. The backend validates requests and authenticates protected operations.
3. SQLite stores structured metadata such as users, sessions, folders, file names, file sizes, and share-link expiry times.
4. Uploaded file contents are stored on the server's filesystem. The database records the stored file identifier and metadata.
5. The backend checks ownership before allowing a user to browse, modify, preview, or download their files.
6. Share links use generated tokens and expiry timestamps. The owner can revoke a link.
7. Phone pairing uses a time-limited QR code. A successful claim creates a session for the paired device.

### Architecture at a glance

```text
┌─────────────────────────────┐
│        Web browser          │
│     React + Vite client     │
└──────────────┬──────────────┘
               │ HTTP / JSON
               ▼
┌─────────────────────────────┐
│        Express API          │
│ Auth · Files · Folders      │
│ Sharing · Pairing · Storage │
└──────────┬───────────┬──────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌──────────────────┐
│ SQLite database│  │ Server filesystem│
│ Metadata       │  │ Uploaded content │
└────────────────┘  └──────────────────┘
```

In production, the Express server can serve the built frontend as well as the API, so the browser and API can share one origin.

## 📁 Project structure

```text
CLOUD9/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── components/      # Shared UI components and dialogs
│   │   ├── pages/           # Files, login, devices, sharing, storage, etc.
│   │   ├── api.js            # Frontend API helper
│   │   ├── auth.jsx          # Authentication state/helpers
│   │   ├── App.jsx           # Routes and application layout
│   │   ├── index.css         # Global styles
│   │   └── main.jsx          # React entry point
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── src/
│   │   ├── middleware/       # Authentication and request limits
│   │   ├── routes/           # Auth, files, folders, pairing, sharing, storage
│   │   ├── utils/            # Filesystem, validation, storage, network helpers
│   │   ├── config.js         # Environment-driven configuration
│   │   ├── db.js             # SQLite setup and schema
│   │   └── index.js          # Express app entry point
│   ├── test/
│   │   └── api.test.js       # API tests
│   ├── .env.example
│   └── package.json
├── Dockerfile
├── render.yaml
└── README.md
```

The exact set of page and utility files can vary by branch as features are added.

## 🚀 Getting started locally

### Prerequisites

Install the following before running the project:

- Node.js **18.15 or later** (the Dockerfile uses Node 22)
- npm
- Git
- A C++ build toolchain may be required on some platforms to install `better-sqlite3` if a prebuilt binary is unavailable.

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd CLOUD9
```

Replace the placeholder with your repository's actual Git URL.

### 2. Configure the backend

```bash
cd server
npm install
```

Create a `.env` file by copying the example:

**Windows PowerShell**
```powershell
Copy-Item .env.example .env
```

**macOS / Linux**
```bash
cp .env.example .env
```

Review the variables in `.env`. The defaults are intended for local development. Keep `.env` private and do not commit real credentials.

### 3. Start the backend

From the `server` directory:

```bash
npm run dev
```

The API defaults to `http://localhost:4000`.

### 4. Start the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Vite normally serves the client at `http://localhost:5173`. Open that URL in your browser. The Vite configuration forwards `/api` requests to the backend during development.

### 5. Create an account

Open the app and register the first account. The first registered user becomes the owner. Additional registrations depend on the `ALLOW_REGISTRATION` setting.

### 6. Test the basic workflow

1. Sign in.
2. Create a folder.
3. Upload a file.
4. Preview or download it.
5. Rename or move it.
6. Create a share link and test it in a private/incognito window.
7. Visit **Devices** to inspect active sessions and try phone pairing.
8. Visit **Storage** to inspect usage and allocation.
9. If your checked-out version includes Trash & Recovery, test delete, restore, and permanent deletion in that page.

## ⚙️ Environment variables

These variables are read by the backend. Values shown here are the defaults from `server/.env.example`; adjust them for your environment.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port used by the Express server; hosting platforms may set this automatically |
| `HOST` | `0.0.0.0` | Interface on which the server listens |
| `DB_PATH` | `./data/cloud9.db` | Path to the SQLite database file |
| `STORAGE_DIR` | `./storage` | Directory for uploaded file data |
| `DEFAULT_STORAGE_LIMIT_GB` | `10` | Initial storage allocation in GB |
| `SESSION_DAYS` | `30` | Session lifetime in days |
| `ALLOW_REGISTRATION` | `false` | Whether accounts can be registered after the first owner |
| `CORS_ORIGIN` | `*` | Allowed browser origin(s) for CORS |
| `PUBLIC_URL` | empty | Optional public/base URL used to build QR pairing links |
| `CLIENT_DIST` | `../client/dist` | Built frontend directory served in production |

Optional demo-seeding variables are documented in `server/.env.example`:

- `DEMO_SEED`
- `DEMO_USERNAME`
- `DEMO_PASSWORD`

Only enable demo seeding for a disposable demo environment and use a throwaway password. Do not publish credentials in the README, source code, screenshots, or commit history.

### Storage paths

The database and uploaded files are stored separately:

- `DB_PATH` points to SQLite metadata.
- `STORAGE_DIR` points to the actual uploaded file contents.

For self-hosting, choose directories with enough free space and ensure the server process has read/write permission. Back up both the database and uploaded file directory together.

## 🐳 Run with Docker

The root `Dockerfile` builds the frontend and packages the Express server into one image. The image expects persistent data under `/data`.

From the repository root:

```bash
docker build -t cloud9 .
docker volume create cloud9-data
docker run -d \
  --name cloud9 \
  -p 4000:4000 \
  -v cloud9-data:/data \
  cloud9
```

Then open `http://localhost:4000`.

The named volume preserves the database and uploaded files when the container is recreated. For production, also plan regular backups and keep the volume protected.

> On Windows PowerShell, the multiline command syntax differs. You can run the same options on one line or use PowerShell backticks for line continuation.

## ☁️ Deploy to Render

This repository includes a `render.yaml` Blueprint configuration and a Dockerfile.

### General deployment steps

1. Push the project to GitHub.
2. In Render, create a new **Blueprint** and select the repository, or create a Docker-based Web Service.
3. Review the environment variables before deploying.
4. Set a strong, unique `DEMO_PASSWORD` if the Blueprint's demo-seeding option is enabled.
5. Wait for the build and deployment to complete.
6. Open the Render URL and test registration/login, file upload/download, sharing, and device management.

The health-check endpoint is:

```text
GET /api/health
```

### Important: persistence on Render

A default Render web service may have an ephemeral filesystem. Files written to the local filesystem can be lost after a restart, redeploy, or instance replacement unless a persistent disk is configured and the database and upload directory are placed on it. Free-plan capabilities and persistent-disk availability can change, so check the current Render plan and service settings.

For a demo, use non-sensitive test files. Do not treat a deployment with ephemeral storage as a reliable backup or long-term cloud drive.

## 🔌 API overview

All API routes use the `/api` prefix. Most endpoints require authentication. Request bodies and responses are JSON except file uploads, previews, and downloads.

| Area | Endpoint | Purpose |
| --- | --- | --- |
| Health | `GET /api/health` | Check that the server responds |
| Auth | `GET /api/auth/status` | Check whether users exist and registration is open |
| Auth | `POST /api/auth/register` | Register an account |
| Auth | `POST /api/auth/login` | Sign in |
| Auth | `POST /api/auth/logout` | End the current session |
| Auth | `GET /api/auth/me` | Get the current user |
| Devices | `GET /api/auth/devices` | List active sessions for the current user |
| Devices | `DELETE /api/auth/devices/:id` | Revoke a session |
| Files | `GET /api/files/browse` | Browse files/folders; optional `folderId` query |
| Files | `GET /api/files/search?q=...` | Search file and folder names |
| Files | `GET /api/files/recent` | List recent files |
| Files | `POST /api/files/upload` | Upload files using multipart field `files`; optional `folderId` query |
| Files | `GET /api/files/:id/preview` | Preview a file |
| Files | `GET /api/files/:id/download` | Download a file |
| Files | `PATCH /api/files/:id` | Rename and/or move a file |
| Files | `DELETE /api/files/:id` | Delete a file |
| Folders | `POST /api/folders` | Create a folder |
| Folders | `PATCH /api/folders/:id` | Rename and/or move a folder |
| Folders | `DELETE /api/folders/:id` | Delete a folder |
| Sharing | `POST /api/share/files/:id` | Create a share link; optional expiry in hours |
| Sharing | `GET /api/share` | List the current user's share links |
| Sharing | `DELETE /api/share/:id` | Revoke a share link |
| Public sharing | `GET /api/share/:token/info` | Get shared-file information without signing in |
| Public sharing | `GET /api/share/:token/download` | Download a shared file without signing in |
| Pairing | `POST /api/pairing/create` | Create a QR pairing code |
| Pairing | `GET /api/pairing/:code/status` | Check pairing status |
| Pairing | `POST /api/pairing/claim` | Claim a valid pairing code |
| Storage | `GET /api/storage` | Get storage usage and allocation |
| Storage | `PUT /api/storage` | Update the storage allocation |

This is a route overview, not a substitute for the validation rules in the source. The exact Trash & Recovery endpoints depend on the version of the code currently deployed.

### Example: health check

```bash
curl http://localhost:4000/api/health
```

Example response:

```json
{
  "ok": true,
  "name": "cloud9",
  "time": 0
}
```

The `time` value is generated at request time, so it will differ on each request.

## 🔐 Security notes

CLOUD9 includes several baseline protections, but a student project should not automatically be considered production-hardened.

- Passwords are hashed with `bcryptjs`; passwords should never be stored as plain text.
- Protected file, folder, storage, and device routes require an authenticated session.
- File operations check that the requested resource belongs to the signed-in user.
- Login and pairing endpoints use rate-limiting helpers.
- Request payloads are validated with Zod schemas.
- Share links use unguessable generated tokens and expiry timestamps; owners can revoke them.
- File preview responses apply headers intended to reduce the risk of executing uploaded HTML/SVG content in the app origin.
- Use HTTPS for any public deployment and avoid uploading private or sensitive documents to a demo instance.
- Use strong passwords, restrict registration when appropriate, and never commit `.env` files or production secrets.
- Keep Node.js and npm dependencies updated.
- Back up both the SQLite database and uploaded content. A database-only backup is not enough to recover the actual files.

**Security scope:** This README describes the protections implemented in the project source; it is not a third-party security audit. Review deployment configuration, CORS settings, public share links, storage permissions, and session behavior before using real personal data.

## 🧪 Testing

The backend test script uses Node's built-in test runner.

From the `server` directory:

```bash
npm test
```

To create a production frontend build:

```bash
cd client
npm run build
```

Before submitting or deploying, manually verify:

- [ ] First account registration and login
- [ ] Invalid login attempts
- [ ] File upload and download
- [ ] File preview
- [ ] File rename and move
- [ ] Folder create, rename, move, and delete
- [ ] Search and recent files
- [ ] Share link expiry and revocation
- [ ] QR pairing from a second browser/device
- [ ] Device/session revocation
- [ ] Storage usage and allocation
- [ ] Trash, restore, and permanent deletion if present in the current version
- [ ] Responsive layout on a narrow mobile screen
- [ ] Persistence behavior after restart/redeploy in the target hosting environment

## ⚠️ Known limitations

- **Local filesystem storage:** Uploaded content is stored on the server filesystem, not automatically in a third-party object-storage service.
- **Hosting persistence:** Ephemeral hosting filesystems can lose uploaded files and SQLite data when an instance is replaced.
- **No automatic backup guarantee:** Users must configure backups of both the database and file contents.
- **Share links are bearer links:** Anyone who obtains a valid share URL can access the shared file until the link expires or is revoked.
- **Pairing depends on network reachability:** For local development, the phone and computer generally need to be on the same Wi-Fi network and the configured URL must be reachable from the phone.
- **Demo configuration:** Public demo accounts and open registration should not be used with sensitive data.
- **Feature parity can vary:** The exact Trash & Recovery implementation depends on which feature changes have been merged into the branch deployed to Render.

## 🛣️ Future improvements

Potential directions for further development:

- Configure persistent storage and automated backups for deployments.
- Add optional external object storage for deployments that need scalable durable storage.
- Add stronger upload quotas and clearer per-user storage reporting.
- Improve accessibility and keyboard navigation.
- Add more automated tests for file ownership, sharing expiry, pairing expiry, and recovery workflows.
- Add a clear export/backup workflow for users who self-host the application.
- Improve deployment health and storage diagnostics.

## 🤝 Contributing

Contributions, bug reports, and improvement ideas are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make a focused change.
4. Run the backend tests and frontend production build.
5. Open a pull request with a description of the change and how it was tested.

Please do not include credentials, personal files, database files, or uploaded content in commits.

## 📄 License

No license is specified in this README. Add a `LICENSE` file and update this section if you intend to grant others permission to use, modify, or distribute the project.

---

Made with ☁️, 🌊, and a lot of care.
