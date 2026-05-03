# apps/backend/Dockerfile
# Build context must be the root of the repository:
# docker build -t btb-backend:v1 -f apps/backend/Dockerfile .

FROM node:20-alpine
WORKDIR /app

# Copy root package.json and package-lock.json
COPY package*.json ./

# Copy all workspaces to ensure local dependencies (like @btb/shared) are resolved
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Install dependencies (We run a full ci because the backend relies on 'tsx' which is in devDependencies)
RUN npm ci

# Set working directory to the backend workspace
WORKDIR /app/apps/backend

EXPOSE 3001
CMD ["npm", "run", "start"]
