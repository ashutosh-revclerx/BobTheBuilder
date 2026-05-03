# apps/frontend/Dockerfile
# Build context must be the root of the repository:
# docker build -t btb-frontend:v1 -f apps/frontend/Dockerfile .

# Stage 1: Build the React application
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package.json and package-lock.json
COPY package*.json ./

# Copy all workspaces to ensure local dependencies (like @btb/shared) are resolved
COPY packages/ ./packages/
COPY apps/ ./apps/

# Install all dependencies across workspaces
RUN npm ci

# Build only the frontend workspace
RUN npm run build -w @btb/frontend

# Stage 2: Serve with Nginx
FROM nginx:alpine
# Copy built static files to Nginx HTML directory
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
# Copy custom Nginx configuration to enable SPA routing
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
