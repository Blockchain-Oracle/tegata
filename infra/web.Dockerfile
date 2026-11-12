# Tegata web (Next.js standalone). Build context: the repo root.
FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter @tegata/web...
# Public values the browser bundle needs at build time (not secrets).
ARG NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tegata/web build

FROM node:24-alpine AS run
RUN apk add --no-cache curl && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
USER app
EXPOSE 3100
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=4 CMD curl -fsS http://127.0.0.1:3100/api/health || exit 1
CMD ["node", "apps/web/server.js"]
