# --- Dependencies --------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
# react-native-web + RN deps resolve a broad tree; allow peer flexibility.
RUN npm install --no-audit --no-fund --legacy-peer-deps

# --- Build ---------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- Runtime -------------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next standalone output: minimal server + traced node_modules.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/v1/health >/dev/null 2>&1 || exit 1

CMD ["node", "server.js"]
