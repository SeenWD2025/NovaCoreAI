# Stage 1: Build
## Development-focused Dockerfile
## The docker-compose.yml maps port 5173 and mounts the source directory.
## This image runs the Vite dev server for live reload instead of a static nginx build.

FROM node:20-alpine

WORKDIR /app

# Add CA certs and fallback to HTTP registry to mitigate TLS cipher errors under interception
RUN apk add --no-cache ca-certificates openssl \
	&& update-ca-certificates \
	&& npm config set strict-ssl false \
	&& npm config set registry http://registry.npmjs.org/ \
	&& npm config set fetch-retry-maxtimeout 600000 \
	&& npm config set fetch-retry-mintimeout 20000

# Copy manifests
COPY package*.json ./

# Install dependencies (allow offline retry fallback)
RUN npm install --no-audit --no-fund || npm install --no-audit --no-fund --prefer-offline \
	&& npm cache clean --force || true

# Copy application source
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
