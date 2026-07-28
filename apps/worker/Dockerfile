FROM node:24-alpine

RUN corepack enable
WORKDIR /app

COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @agentrail-sdk/worker... build

ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/runtime.js"]
