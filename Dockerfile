FROM node:20-slim AS base

WORKDIR /app

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 8080

CMD ["node", "src/index.js"]
