# Production images (PLAN M9.6). Two targets, built from the repository root:
#   docker build --target api -t commerce-api .   # the API; the worker is the same image with
#                                                  # `node apps/api/src/worker.ts` as its command
#   docker build --target web -t commerce-web .   # nginx: the built dashboard + a proxy to the API
# docker-compose.prod.yml builds and runs both; docs/deploy.md explains the setup.

# Node runs our TypeScript sources directly (type stripping, Node 22.18+), as in development, so the
# API has no build step. The sources must stay outside node_modules (Node refuses to strip types
# there), which is why the image keeps the workspace layout instead of using `pnpm deploy`.
FROM node:22.23.0-bookworm-slim AS base
RUN npm install --global pnpm@11.13.1 && npm cache clean --force
WORKDIR /app

# Every workspace manifest, so `pnpm install --frozen-lockfile` sees the lockfile's whole workspace.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/storefront/package.json apps/storefront/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/tsconfig/package.json packages/tsconfig/

# --- dashboard: built with Vite, served by nginx -------------------------------------------------
FROM manifests AS dashboard-build
RUN pnpm install --frozen-lockfile --filter "@commerce/dashboard..."
COPY packages/tsconfig packages/tsconfig
COPY packages/contracts packages/contracts
COPY apps/dashboard apps/dashboard
# The API's URL as the browser sees it; "/graphql" = the same origin, through nginx (infra/nginx).
ARG VITE_API_URL=/graphql
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @commerce/dashboard build

FROM nginx:1.29.3-alpine AS web
COPY infra/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=dashboard-build /app/apps/dashboard/dist /usr/share/nginx/html

# --- API and worker: production dependencies + sources --------------------------------------------
FROM manifests AS api-deps
RUN pnpm install --frozen-lockfile --prod --filter "@commerce/api..."

FROM base AS api
ENV NODE_ENV=production
COPY --from=api-deps /app /app
COPY packages/contracts/src packages/contracts/src
COPY packages/db/src packages/db/src
COPY packages/db/drizzle packages/db/drizzle
COPY apps/api/src apps/api/src
# Tests live next to the sources; they are not part of the image.
RUN find apps packages -name "*.test.ts" -delete
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/api/src/server.ts"]
