# ConnectLens frontend — React SPA built with Vite, served by nginx.
# Multi-stage: node build -> static assets copied into an nginx image.

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps against the lockfile for reproducible builds.
COPY package.json package-lock.json* ./
RUN npm ci

# Build the SPA (tsc -b && vite build -> dist/).
COPY . .
RUN npm run build

# ---- Stage 2: serve ---------------------------------------------------------
FROM nginx:1.27-alpine

# SPA fallback + /api reverse proxy (with SSE-safe settings) live here.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static assets from the Vite build.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
