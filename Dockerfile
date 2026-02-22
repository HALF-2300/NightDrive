# NightDrive / AutoElite — deploy anywhere that runs Docker
# Render injects PORT at runtime; do not set PORT here.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.js"]
