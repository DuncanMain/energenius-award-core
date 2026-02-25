# Build stage
FROM node:22.14.0-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npx prisma generate
RUN npm run build
RUN test -f dist/main.js || test -f dist/src/main.js

# Production stage
FROM node:22.14.0-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
RUN test -f dist/main.js || test -f dist/src/main.js

EXPOSE 3001

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && if [ -f dist/main.js ]; then node dist/main; elif [ -f dist/src/main.js ]; then node dist/src/main; else echo 'No Nest entrypoint found in dist' >&2; ls -la dist || true; exit 1; fi"]
