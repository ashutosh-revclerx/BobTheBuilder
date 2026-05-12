# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests first so npm ci is cached separately from source.
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json    ./apps/frontend/

RUN npm ci

# Copy source (after install to maximise layer cache hits)
COPY packages/shared ./packages/shared
COPY apps/frontend   ./apps/frontend

# VITE_API_BASE_URL is baked into the JS bundle at build time.
# Leave it unset (or set to /api/v1) when nginx proxies /api to the backend.
# Override via --build-arg for deployments where the API lives at a different origin.
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build -w @btb/frontend

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
