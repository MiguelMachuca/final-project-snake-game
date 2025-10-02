# syntax=docker/dockerfile:1

# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install serve globally
RUN npm install -g serve

# Create non-root user and switch to it
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

# Copy build artifacts from builder stage
COPY --from=builder /app/build ./build

# Add health check
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:3000/ || exit 1

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]