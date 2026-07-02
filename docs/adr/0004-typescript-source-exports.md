# 0004 — Cross-package TypeScript: source exports, not project references

- **Status:** Accepted
- **Date:** 2026-07-01
- **Related:** [0001-foundation.md](0001-foundation.md),
  [0003-spa-default-tanstack-start-opt-in.md](0003-spa-default-tanstack-start-opt-in.md),
  [plan T0.2](../plans/0001-foundation-implementation-plan.md)

## Context

T0.2 must decide how cross-package types and incremental typecheck work in the
monorepo. Options: **TS project references** (the plan's stated default),
**bundler `paths` aliases**, or **source exports** (packages consumed as
TypeScript source — Turborepo's "just-in-time packages" pattern).

Deciding constraints:

- ADR 0003's load-bearing seam bundles the tRPC router + PGlite **from package
  source into the browser** (Playwright CT build) and into the Vite dev-server
  middleware with HMR across package boundaries.
- ADR 0001 prizes a fast, low-ceremony inner loop; repo scale is ~5 packages
  plus a handful of leaf apps.

## Decision

Internal packages are consumed **as TypeScript source**:

- Each `packages/*` `package.json` `exports` points at `.ts` source files.
- Consumers depend on them via `workspace:*`; no path aliases.
- Each package/app typechecks itself with `tsc --noEmit`; **Turborepo caching**
  provides the incrementality that project references would otherwise supply.
- No `composite`, no declaration emit, no `tsc -b` orchestration, no build step
  for internal packages. (Apps still build with Vite; that is unaffected.)

**Why not project references (the plan default):** they require `composite`,
declaration emit, and keeping `references` arrays in sync, and they put `dist`
artifacts into exactly the seams ADR 0003 optimises — Vite HMR across packages
and bundling package source into the CT browser build would need a parallel
source-resolution story anyway. At this scale references buy nothing that the
turbo cache doesn't.

**Why not `paths`:** aliases duplicate what pnpm workspace resolution already
does and blur package boundaries.

## Consequences

- **Positive:** zero build step for packages; Vite / Playwright CT / the dev
  middleware consume one canonical source; simplest possible add-an-app path.
- **Costs:** each consumer re-typechecks the package source it imports —
  acceptable at this scale; **revisit project references if typecheck times
  grow**. Internal packages are not individually publishable (not a goal).
- `turbo.json` `typecheck`/`test` need no `^build` dependency.
- Source-exported code is sometimes loaded by **native Node ESM with
  type-stripping** (e.g. `vite.config.ts` importing the simulator wiring), so
  **relative imports must carry explicit `.ts`/`.tsx` extensions**
  (`allowImportingTsExtensions` is set in the base tsconfig) and package code
  must stick to erasable TypeScript syntax (no enums/namespaces, **no
  constructor parameter properties** — declare fields explicitly).
- **Production images must keep workspace packages as symlink targets outside
  `node_modules`** (the pruned-monorepo layout: `/app/packages/*` +
  `node_modules/@hoe/* → symlink`). Node refuses to type-strip real files
  under `node_modules`, which rules out `pnpm deploy`'s materialised copy;
  and bundling the server instead breaks transitive-dep resolution under
  pnpm's isolated layout. See `apps/hub/Dockerfile` for the canonical stages.
