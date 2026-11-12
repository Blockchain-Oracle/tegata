# Tegata worker (pg-boss jobs, the only holder of operator keys). Build context: the repo root.
FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile --prod=false --filter @tegata/worker...

FROM node:24-alpine AS run
RUN addgroup -S app && adduser -S app -G app
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=deps --chown=app:app /repo ./
USER app
WORKDIR /repo/apps/worker
CMD ["node", "--import", "tsx", "src/index.ts"]
