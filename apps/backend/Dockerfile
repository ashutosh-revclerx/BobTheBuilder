# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json    ./apps/backend/

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/backend    ./apps/backend

RUN npm run build -w @btb/backend

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json    ./apps/backend/

RUN npm ci --omit=dev

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY packages/shared ./packages/shared

EXPOSE 3001

CMD ["node", "apps/backend/dist/server.js"]
