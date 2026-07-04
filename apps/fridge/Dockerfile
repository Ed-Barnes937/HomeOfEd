# fridge — production image. Build context is the REPO ROOT (turbo prune needs
# the whole monorepo):   docker build -f apps/fridge/Dockerfile .
#
# Per-app values when copying this file: the app name in `turbo prune`/`turbo
# build --filter`, the prod-deps --filter list (the app + its RUNTIME workspace
# deps), the runtime COPY lines/paths, and the EXPOSE port. If the app gains a
# database, add @hoe/db back to the prod-deps --filter and the runtime COPY
# (see apps/hub/Dockerfile).
#
# The server runs its TS source natively (Node type stripping — ADR 0004's
# erasable-syntax rule). Workspace packages live at /app/packages/* and are
# only SYMLINKED from node_modules: Node refuses to type-strip real files
# under node_modules, but symlink targets outside it are fine.
#
# fridge is database-backed as of phase 3 (ADR 0010 — shared boards in
# Postgres). @hoe/db is filtered into prod-deps and copied into the runtime the
# same way backend-kit/logger are, and PGlite (its dev/test-only driver) is
# stripped from the prod image below. It also depends on @hoe/magnet-kit (the
# pure-TS collision engine), filtered/copied the same way.

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── stage 1: prune the monorepo to fridge's subtree ─────────────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.2 prune fridge --docker

# ── stage 2: full install + build (dev deps allowed here only) ──────────────
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm exec turbo build --filter=fridge

# ── stage 3: production node_modules only ───────────────────────────────────
# Filtered to the app + its runtime workspace deps: dev-only workspace packages
# (test-kit, config) are skipped, so none of THEIR deps (playwright, vite,
# eslint, …) land here; --prod drops dev deps everywhere else.
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod \
  --filter=fridge --filter=@hoe/db --filter=@hoe/backend-kit --filter=@hoe/logger --filter=@hoe/magnet-kit

# ── stage 4: runtime — prod deps + package source + the built SPA ───────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app ./
# Runtime package source (TS source exports). Only the app's runtime deps —
# @hoe/config and @hoe/test-kit are dev-only and must NOT appear here.
COPY --from=pruner /app/out/full/packages/db ./packages/db
COPY --from=pruner /app/out/full/packages/backend-kit ./packages/backend-kit
COPY --from=pruner /app/out/full/packages/logger ./packages/logger
COPY --from=pruner /app/out/full/packages/magnet-kit ./packages/magnet-kit
# The app: server source (runs natively) + the built SPA bundle.
COPY --from=pruner /app/out/full/apps/fridge/src ./apps/fridge/src
COPY --from=builder /app/apps/fridge/dist ./apps/fridge/dist
# The app's own test sources aren't runtime code. Neither are two lockfile
# stowaways: pglite (@hoe/db's dev/test driver — only the pglite path imports
# it, and that never runs in prod) and typescript (@trpc/server declares it as
# a types-only peer). The dev-only workspace stubs (test-kit/config) go too.
RUN rm -rf apps/fridge/src/testing apps/fridge/src/fridge.iwft.tsx \
  packages/test-kit packages/config \
  node_modules/.pnpm/@electric-sql+pglite@* node_modules/.pnpm/typescript@*
USER node
EXPOSE 8080
WORKDIR /app/apps/fridge
CMD ["node", "src/server/main.ts"]
