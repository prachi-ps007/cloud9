# Cloud9 - one image that builds the React app and runs the Express server.
# Place this file at the ROOT of your repo (next to the client and server folders).

# ---- 1. build the React client ----
FROM node:22-slim AS client
WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client ./
RUN npm run build

# ---- 2. install server dependencies in a full image (has python, make, g++ for better-sqlite3) ----
FROM node:22-bookworm AS server-deps
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev

# ---- 3. final slim image: server + built client ----
FROM node:22-slim
WORKDIR /app
COPY --from=server-deps /app/node_modules ./node_modules
COPY server/package*.json ./
COPY server/src ./src
COPY --from=client /client/dist ./public

# Data goes to /data. Self-hosting: docker run -v cloud9-data:/data ...
ENV NODE_ENV=production \
    DB_PATH=/data/cloud9.db \
    STORAGE_DIR=/data/storage \
    CLIENT_DIST=/app/public

CMD ["node", "src/index.js"]