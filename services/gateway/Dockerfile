# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install certificates and set npm to use HTTP registry
RUN apk add --no-cache ca-certificates openssl \
	&& update-ca-certificates \
	&& npm config set strict-ssl false \
	&& npm config set registry http://registry.npmjs.org/ \
	&& npm config set fetch-retry-maxtimeout 600000 \
	&& npm config set fetch-retry-mintimeout 20000

# Copy manifests
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install certificates
RUN apk add --no-cache ca-certificates openssl \
	&& update-ca-certificates

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --no-audit --no-fund || npm install --only=production --no-audit --no-fund --prefer-offline \
	&& npm cache clean --force || true

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Create non-root user and switch to it
RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["node", "dist/index.js"]
