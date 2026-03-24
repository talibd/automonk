FROM node:20-alpine AS dashboard-builder
WORKDIR /build/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

FROM node:20-alpine AS app-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app

COPY --from=app-deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY templates ./templates
COPY assets ./assets
COPY db ./db
COPY --from=dashboard-builder /build/dashboard/dist ./dashboard/dist

EXPOSE 3000
CMD ["node", "src/app.js"]
