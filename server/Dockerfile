# ============================================================================
# KinderCRM Backend — multi-stage NestJS Dockerfile
# ============================================================================
# Stage 1: install all deps (incl. dev) + prisma generate
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --include=dev && npx prisma generate

# Stage 2: build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# Stage 3: production image
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV TZ=Asia/Dushanbe
WORKDIR /app

# Только prod-deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Prisma client + миграции
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

USER node
EXPOSE 4000

# При первом старте применяем миграции, затем стартуем API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
