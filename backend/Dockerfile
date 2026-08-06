# --- Dependencies --------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# --- Build ---------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client + compile TypeScript to dist/
RUN npx prisma generate && npm run build

# --- Runtime -------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

EXPOSE 4000

# Run migrations on boot, then start the compiled server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
