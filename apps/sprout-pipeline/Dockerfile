# sprout-pipeline — production image, HEADLESS safety service (plan 0004 §5.5 /
# §9.1, D7). Bare Fastify, no SPA, no database. Build context is the REPO ROOT
# (turbo prune needs the whole monorepo):
#   docker build -f apps/sprout-pipeline/Dockerfile .
#
# Simpler than a web app's image: no `build` step (headless — no SPA bundle; the
# package's `build` script is a no-op), no @hoe/db, no PGlite, no dist/. It runs
# its TS source natively (Node type stripping — ADR 0004). Workspace packages
# live at /app/packages/* and are only SYMLINKED from node_modules.

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── stage 1: prune the monorepo to sprout-pipeline's subtree ─────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.2 prune sprout-pipeline --docker

# ── stage 2: production node_modules only ───────────────────────────────────
# Headless service: its runtime workspace deps are @hoe/logger + @hoe/sprout-
# shared only (no @hoe/backend-kit, no @hoe/db). --prod drops dev deps
# (vitest, eslint, …); the dev-only @hoe/config stub is never in this filter.
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod \
  --filter=sprout-pipeline --filter=@hoe/logger --filter=@hoe/sprout-shared

# ── stage 3: runtime — prod deps + package source + the service source ───────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app ./
# Runtime package source (TS source exports). Only the service's runtime deps.
COPY --from=pruner /app/out/full/packages/logger ./packages/logger
COPY --from=pruner /app/out/full/packages/sprout-shared ./packages/sprout-shared
# The service source (runs natively). No dist/ — this app has no SPA.
COPY --from=pruner /app/out/full/apps/sprout-pipeline/src ./apps/sprout-pipeline/src
# Test sources aren't runtime code; typescript is a lockfile stowaway (types-
# only peer). The dev-only @hoe/config stub goes too.
RUN rm -rf apps/sprout-pipeline/src/*.test.ts apps/sprout-pipeline/src/eval \
  packages/config \
  node_modules/.pnpm/typescript@*
USER node
EXPOSE 8080
WORKDIR /app/apps/sprout-pipeline
CMD ["node", "src/index.ts"]
