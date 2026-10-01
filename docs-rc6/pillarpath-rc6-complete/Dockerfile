# Multi-stage build for PillarPath RC6
# Stage 1: Dependencies & Build
FROM node:22-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache python3 make g++ libpq

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm ci --only=development

# Copy source
COPY . .

# Build application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache libpq

# Copy built app from builder
COPY --from=builder /build/.vercel ./
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/package.json ./
COPY --from=builder /build/migrations ./migrations

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080), (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 8080

# Environment variables (can be overridden)
ENV NODE_ENV=production \
    PORT=8080

# Run Vercel-built server
CMD ["node", ".vercel/output/functions/__server.func/index.mjs"]
