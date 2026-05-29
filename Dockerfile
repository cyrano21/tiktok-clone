# --- Build stage ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (use lockfile-agnostic install since only package.json is guaranteed)
# --legacy-peer-deps: react-native 0.73 stack pins react@18 while some dev tooling
# (e.g. @testing-library/react-native) pulls react-test-renderer@19. Dev/test deps
# aren't needed for the static web build, but npm still resolves the full tree.
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps

# Build the static web bundle
COPY . .
RUN npm run web:build

# --- Runtime stage -------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

# SPA-friendly nginx config (history fallback to index.html)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets produced by Vite
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
