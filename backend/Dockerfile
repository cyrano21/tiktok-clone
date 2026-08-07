# Build context is the repository root. This is also how docker-compose/Coolify
# must invoke this Dockerfile so backend/* paths resolve consistently.

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN npm install --no-audit --no-fund --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY backend/. .
RUN npx prisma generate && npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Required by the real upload pipeline: ffprobe inspects media and ffmpeg
# normalizes/transcodes it and produces server-side thumbnails.
RUN apk add --no-cache ffmpeg font-dejavu

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY backend/package*.json ./

EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
