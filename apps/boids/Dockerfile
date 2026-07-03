# boids — production image. Build context is the REPO ROOT (turbo prune needs
# the whole monorepo):   docker build -f apps/boids/Dockerfile .
#
# Per-app values when copying this file: the app name in `turbo prune`/`turbo
# build --filter`, the prod-deps --filter list (the app + its RUNTIME workspace
# deps), the runtime COPY lines, and the EXPOSE port.
#
# The server runs its TS source natively (Node type stripping — ADR 0004's
# erasable-syntax rule). Workspace packages live at /app/packages/* and are
# only SYMLINKED from node_modules: Node refuses to type-strip real files
# under node_modules, but symlink targets outside it are fine.
#
# boids has no database (ADR 0006): no @hoe/db in prod-deps, no packages/db copy.

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── stage 1: prune the monorepo to boids's subtree ──────────────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.2 prune boids --docker

# ── stage 2: full install + build (dev deps allowed here only) ──────────────
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm exec turbo build --filter=boids

# ── stage 3: production node_modules only ───────────────────────────────────
# Filtered to the app + its runtime workspace deps: dev-only workspace
# packages (test-kit, config) are skipped entirely, so none of THEIR deps
# (playwright, vite, eslint, …) land here; --prod drops dev deps everywhere else.
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod \
  --filter=boids --filter=@hoe/backend-kit --filter=@hoe/logger

# ── stage 4: runtime — prod deps + package source + the built SPA ───────────
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app ./
# Runtime package source (TS source exports). Only the app's runtime deps —
# @hoe/config and @hoe/test-kit are dev-only and must NOT appear here.
COPY --from=pruner /app/out/full/packages/backend-kit ./packages/backend-kit
COPY --from=pruner /app/out/full/packages/logger ./packages/logger
# The app: server source (runs natively) + the built SPA bundle.
COPY --from=pruner /app/out/full/apps/boids/src ./apps/boids/src
COPY --from=builder /app/apps/boids/dist ./apps/boids/dist
# The app's own test sources aren't runtime code. Neither is the typescript
# lockfile stowaway (@trpc/server declares it as a types-only peer). The
# dev-only workspace stubs (test-kit/config package.json) go too. The pglite
# cleanup from hub's Dockerfile is unnecessary here (nothing pulls it in
# without @hoe/db) but harmless, so it's dropped rather than left as a no-op.
RUN rm -rf apps/boids/src/testing apps/boids/src/boids.iwft.tsx \
  packages/test-kit packages/config \
  node_modules/.pnpm/typescript@*
USER node
EXPOSE 8080
WORKDIR /app/apps/boids
CMD ["node", "src/server/main.ts"]
