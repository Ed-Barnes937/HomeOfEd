# 0088 - the deployed-secrets guard is a package, and sprout is under it

- **Status:** Accepted
- **Date:** 2026-11-10
- **Extends:** [ADR 0078](0078-family-identity-auth-boundary.md) decision 4
  (anything this repo publishes refuses to boot on Fly), from family to sprout
  and sprout-pipeline.
- **Related:** [ADR 0012](0012-sprout-app-owned-auth.md) (sprout's two
  signing secrets), [ADR 0013](0013-headless-service-app-shape.md) (why
  sprout-pipeline has no `@hoe/backend-kit`).

## Context

The repo is public. `apps/sprout/.env.example` publishes
`BETTER_AUTH_SECRET=dev-better-auth-secret-change-me` and
`CHILD_SESSION_SECRET=dev-child-session-secret-change-me`, and `compose.yml`
publishes shorter `dev-*` values for all four of sprout's secrets. Sprout's
entrypoints checked only that `CHILD_SESSION_SECRET` existed, and that
`PIPELINE_API_KEY` and `REGISTRATION_INVITE_CODE` existed in production.
`BETTER_AUTH_SECRET` was not checked at all. A published placeholder therefore
passed every check, and in production it would let anyone forge a parent or
child session, call the safety pipeline directly, or register past the
ADR-0019 pilot gate.

Family already refuses this on Fly (ADR 0078 decision 4). Sprout and
sprout-pipeline need the same rule, and no app may import from another.

## Decision

**1. The rule moves into a new zero-dependency package, `@hoe/deploy-guard`.**
It exports `assertFitForDeployment(env, minLengths)`, `isDeployed(env)` and
`COMMITTED_DEV_SECRETS`. On Fly (`FLY_APP_NAME` set) it refuses any named
secret that is missing, reads as a placeholder, is a committed value or is
below its minimum length, and any `NODE_ENV` but `production`. Off Fly it does
nothing, so local stacks keep their committed values. (Amended by estate-gate
ticket 18: an optional third argument, `localOnly`, names settings refused on
Fly at any value, such as family's `DOCKER_STACK_ORIGINS`; see
[ADR 0078](0078-family-identity-auth-boundary.md) decision 6.)

It is not in `@hoe/backend-kit`, the obvious home. sprout-pipeline
deliberately has no backend-kit at runtime (ADR 0013; its Dockerfile installs
only logger and sprout-shared), and pulling backend-kit in would ship tRPC and
`@fastify/static` into a private service to reach twenty lines of string
checks. The guard is also not about the layered backend that backend-kit
exists for. A package with no dependencies can be consumed by any app,
headless or not.

**2. Family switches over with no change in behaviour.** Its env loader keeps
the zod schema and the committed signing-key check (family-specific, now gated
by `isDeployed`), and hands the two secrets and their floors to the package.
Its `env.test.ts` is unchanged apart from importing `COMMITTED_DEV_SECRETS`
from the package. The only visible difference is the `NODE_ENV` message, which
no longer names family's CORS allowlist specifically.

**3. Sprout and sprout-pipeline are guarded at boot, with these floors:**

| App                 | Process     | Secret                     | Minimum on Fly |
| ------------------- | ----------- | -------------------------- | -------------- |
| hoe-sprout          | web         | `BETTER_AUTH_SECRET`       | 32             |
| hoe-sprout          | web         | `CHILD_SESSION_SECRET`     | 32             |
| hoe-sprout          | web, worker | `PIPELINE_API_KEY`         | 32             |
| hoe-sprout          | web         | `REGISTRATION_INVITE_CODE` | 16             |
| hoe-sprout-pipeline | -           | `PIPELINE_API_KEY`         | 32             |

Each process guards only what it reads, so the worker does not need the auth
secrets. The signing and service keys follow Better Auth's own 32. The invite
code is typed by hand, so it takes family's 16. Sprout's env loading moves into
`apps/sprout/src/server/env.ts`, which both entrypoints call before opening the
database, and `main.ts` now passes the checked `BETTER_AUTH_SECRET` to Better
Auth explicitly instead of letting it read `process.env` itself. The existing
off-Fly rules and the `dev-pipeline-key` fallback outside production are
unchanged; on Fly the fallback can no longer be reached because the key is
required and `NODE_ENV` must be `production`.

**4. Each consumer owns a drift test for its own files.** It re-reads its
`.env.example` and its `compose.yml` services and asserts every committed value
is refused on Fly, per file and per name. `COMMITTED_DEV_SECRETS` is the
estate-wide union of those values.

## Consequences

The first deploy of sprout or sprout-pipeline after this lands **refuses to
boot** if Fly still holds a placeholder, or a value below the floors above. That
is intended, but it means the live secrets must be rotated to compliant values
before this merges. `PIPELINE_API_KEY` must stay identical on both apps.

Every app that adopts the package adds it to its Dockerfile's
`pnpm install --filter` list and `COPY`s `packages/deploy-guard`, as family,
sprout and sprout-pipeline now do. Nothing in CI builds the images before
merge, so that step is checked by building them locally.

`OPENROUTER_API_KEY` is not guarded. A placeholder there grants nothing; it
only makes LLM calls fail.
