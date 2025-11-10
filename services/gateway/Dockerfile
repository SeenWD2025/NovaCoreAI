FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./

RUN npm install && npm install --save-dev ts-node

COPY . .

EXPOSE 5000

# Run TypeScript directly for dev; source is mounted via volumes
CMD ["npm", "run", "dev"]
