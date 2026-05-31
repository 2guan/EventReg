# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Pin pnpm to v10 (same as local dev) to avoid v11's build script restrictions
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Copy package files and pnpm config
COPY package.json pnpm-lock.yaml* .npmrc* ./

# Install dependencies (frozen-lockfile for consistency)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend
RUN pnpm build:client

# Production stage
FROM node:22-alpine

WORKDIR /app

# Pin pnpm to v10
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate

# Install production dependencies only
COPY package.json pnpm-lock.yaml* .npmrc* ./
RUN pnpm install --prod --frozen-lockfile

# Copy built frontend assets (includes banners)
COPY --from=builder /app/dist/static ./dist/static

# Ensure banners are present (copy from public/banner if vite didn't include them)
COPY --from=builder /app/public/banner ./dist/static/banner

# Copy server code
COPY server ./server

# Expose port
EXPOSE 3000

# Environment variables (defaults)
ENV PORT=3000
ENV JWT_SECRET=sportsreg_secret_key
ENV NODE_ENV=production
ENV DB_PATH=/app/data/sportsreg.db
ENV WX_APPID=wx1e2e84238449c35b
ENV WX_SECRET=d86f02a9fcfd1f24464484a28944073d

RUN mkdir -p /app/data /app/logs /app/temp /app/dist/static/images /app/dist/static/face/uploads

# Start server with experimental sqlite support
CMD ["node", "--experimental-sqlite", "server/index.js"]
