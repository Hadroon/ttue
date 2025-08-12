# Multi-stage build: First build Angular, then Bun backend
FROM node:20-alpine AS angular-build

# Build Angular frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Bun backend stage  
FROM oven/bun:1

WORKDIR /app

# Copy backend dependencies first for better caching
COPY backend/package.json backend/bun.lockb* ./
RUN bun install --frozen-lockfile || bun install

# Copy backend source
COPY backend/ .

# Copy built Angular app from previous stage
COPY --from=angular-build /frontend/dist/earth-forum-app/browser ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["bun", "run", "start"]
