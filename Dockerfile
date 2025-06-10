FROM node:24-alpine AS builder

WORKDIR /app

# COPY package.json package-lock.json ./
COPY package*.json ./
RUN npm ci

COPY . .

RUN echo 'export * from "./sqlite";' > server/db/index.ts

RUN npx drizzle-kit generate --dialect sqlite --schema ./server/db/sqlite/schema.ts --out init

RUN npm run build:sqlite

FROM node:24-alpine AS runner

WORKDIR /app

# Curl used for the health checks
RUN apk add --no-cache curl

# COPY package.json package-lock.json ./
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/init ./dist/init

COPY server/db/names.json ./dist/names.json

COPY public ./public

CMD ["npm", "run", "start:sqlite"]
