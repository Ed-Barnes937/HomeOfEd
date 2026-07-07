# sprout — production image, database-backed (plan 0004 §9.1). Build context is
# the REPO ROOT (turbo prune needs the whole monorepo):
#   docker build -f apps/sprout/Dockerfile .
#
# The SAME image runs BOTH Fly process groups — `web` (node src/server/main.ts,
# the SPA + tRPC + SSE + Better Auth server) and `worker` (node
# src/server/worker.ts, the retention/purge loop, D8). fly.toml's [processes]
# picks the command per machine; the CMD below is the local/compose default.
#
# The server runs its TS source natively (Node type stripping — ADR 0004's
# erasable-syntax rule). Workspace packages live at /app/packages/* and are
# only SYMLINKED from node_modules: Node refuses to type-strip real files
# under node_modules, but symlink targets outside it are fine.

FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# ── stage 1: prune the monorepo to sprout's subtree ─────────────────────────
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.2 prune sprout --docker

# ── stage 2: full install + build (dev deps allowed here only) ──────────────
FROM base AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm exec turbo build --filter=sprout

# ── stage 3: production node_modules only ───────────────────────────────────
# Filtered to the app + its runtime workspace deps: dev-only workspace
# packages (test-kit, config) are skipped entirely, so none of THEIR deps
# (playwright, vite, eslint, …) land here; --prod drops dev deps everywhere
# else (pglite is @hoe/db's devDependency).
FROM base AS prod-deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile --prod \
  --filter=sprout --filter=@hoe/db --filter=@hoe/backend-kit --filter=@hoe/logger \
  --filter=@hoe/sprout-shared

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
COPY --from=pruner /app/out/full/packages/sprout-shared ./packages/sprout-shared
# The app: server source (runs natively) + the built SPA bundle.
COPY --from=pruner /app/out/full/apps/sprout/src ./apps/sprout/src
COPY --from=builder /app/apps/sprout/dist ./apps/sprout/dist
# The app's own test sources aren't runtime code. Two lockfile stowaways go too:
# pglite (dragged in as drizzle-orm's resolved optional peer — only the pglite
# driver imports it, and that path never runs in prod; ADR 0001 §5 forbids
# shipping it, asserted by CI) and typescript (@trpc/server declares it as a
# types-only peer). The dev-only workspace stubs (test-kit/config) go too.
RUN rm -rf apps/sprout/src/testing apps/sprout/src/*.iwft.tsx \
  packages/test-kit packages/config \
  node_modules/.pnpm/@electric-sql+pglite@* node_modules/.pnpm/typescript@*
USER node
EXPOSE 8080
WORKDIR /app/apps/sprout
CMD ["node", "src/server/main.ts"]
