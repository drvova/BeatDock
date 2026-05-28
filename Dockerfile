# Build stage
FROM node:22.21-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDeps for TypeScript compilation)
RUN npm ci --ignore-engines

# Copy source files
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22.21-alpine

# Add runtime dependencies
RUN apk add --no-cache tini ffmpeg

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-engines

# Copy compiled output from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy locales for runtime language loading
COPY --chown=nodejs:nodejs locales/ ./locales/

# Switch to non-root user
USER nodejs

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/index.js"]
