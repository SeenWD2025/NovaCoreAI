# Stage 1: Build
## Development-focused Dockerfile
## The docker-compose.yml maps port 5173 and mounts the source directory.
## This image runs the Vite dev server for live reload instead of a static nginx build.

FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install

# Copy the rest of the source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run Vite dev server; --host allows access from Docker host
CMD ["npm", "run", "dev", "--", "--host"]
