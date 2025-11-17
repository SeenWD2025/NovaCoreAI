FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist

# Create non-root user and switch to it
RUN addgroup -g 1000 appuser && adduser -D -u 1000 -G appuser appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3001
CMD ["npm", "start"]
