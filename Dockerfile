# NightDrive / AutoElite — deploy anywhere that runs Docker
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 1335
ENV NODE_ENV=production
ENV PORT=1335
CMD ["node", "server.js"]
