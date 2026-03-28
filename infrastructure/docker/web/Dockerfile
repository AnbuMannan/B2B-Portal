# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-components/package.json ./packages/shared-components/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install dependencies
RUN npm ci --workspace=apps/web --workspace=packages/shared-components --workspace=packages/shared-types

# Copy source code
COPY apps/web ./apps/web
COPY packages/shared-components ./packages/shared-components
COPY packages/shared-types ./packages/shared-types

# Build the application
RUN npm run build --workspace=apps/web

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy package files
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/

# Install production dependencies only
RUN npm ci --workspace=apps/web --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Change ownership to non-root user
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start the application
CMD ["node", "apps/web/server.js"]