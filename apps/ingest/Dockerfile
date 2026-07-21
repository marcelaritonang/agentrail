FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @agentrail/ingest... build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "apps/ingest/dist/runtime.js"]
