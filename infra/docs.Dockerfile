# Tegata docs: the static export, served by nginx. Build context: the repo root.
FROM node:24-alpine AS build
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /repo
COPY . .
# The docs need none of the app's packages, and none of their install scripts.
RUN pnpm install --frozen-lockfile --filter @tegata/docs... --ignore-scripts
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tegata/docs build

FROM nginx:1.27-alpine AS run
COPY apps/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/docs/out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
