FROM node:20-alpine

WORKDIR /app

# Install certificates and set npm to use HTTP registry as a workaround for TLS cipher issues
RUN apk add --no-cache ca-certificates openssl \
	&& update-ca-certificates \
	&& npm config set strict-ssl false \
	&& npm config set registry http://registry.npmjs.org/ \
	&& npm config set fetch-retry-maxtimeout 600000 \
	&& npm config set fetch-retry-mintimeout 20000

# Copy manifests first for better layer caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (build-time for immutable image pattern)
RUN npm install --no-audit --no-fund || npm install --no-audit --no-fund --prefer-offline \
	&& npm cache clean --force || true

# Copy rest of the source
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
