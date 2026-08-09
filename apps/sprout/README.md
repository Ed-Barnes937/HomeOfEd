# sprout

The child-safe LLM web app on `sprout.homeofed.com`, migrated into the hub per
[`docs/plans/0004-sprout-migration-plan.md`](../../docs/plans/0004-sprout-migration-plan.md).
Its headless safety pipeline lives beside it in [`apps/sprout-pipeline`](../sprout-pipeline).

**Current state: the build (P0–P10) is complete.** A Vite SPA (TanStack Router +
Query) over tRPC, a Postgres-backed `SproutStore`, app-owned auth for two
identities (parent + child), SSE chat streaming through the safety pipeline, and a
retention worker. Go-live (P11) is human-gated — see [`docs/go-live.md`](docs/go-live.md).

See [`CLAUDE.md`](CLAUDE.md) for how the moving parts fit together and the layout.

Three ways to run it, one router:

| Mode | Command | Backend |
| --- | --- | --- |
| dev simulator | `pnpm dev --filter=sprout` | real router over Node-side PGlite (port 3004) |
| .iwft | `pnpm test --filter=sprout` | real router in-browser over PGlite; chat SSE scripted |
| docker stack | `docker compose up` | real Dockerfile + real Postgres (host port 8084) |
| production | `pnpm build && pnpm start` | real router, deep `/health` (`store.ping()`) |

Prod is `src/server/main.ts` (`createAppServer`: static SPA + tRPC + the
`/api/chat/stream` SSE route + `/api/auth/*`), with `src/server/worker.ts` as a
second process group for the retention sweep. Migrations run as the Fly
`release_command` (`src/server/migrate.ts`).

`POST /api/chat/stream` is not tRPC, so the `.iwft` PGlite trampoline can't serve
it — it's scripted with the sanctioned `page.route` SSE simulator, and flag
persistence is proven separately in `src/server/chat-sse.test.ts`. Details in
[`CLAUDE.md`](CLAUDE.md).

## Release gates

This app carries a child-safeguarding posture that gates **release**, not merge.
Code and docs land on `main` freely; opening the product to real children and
parents requires both gates closed:

- [`docs/launch-readiness.md`](docs/launch-readiness.md) — the legal / safeguarding
  gate (counsel sign-off, a named Designated Safeguarding Lead). **An agent must
  not tick these items.**
- [`docs/go-live.md`](docs/go-live.md) — the infra gate (Fly apps, Managed
  Postgres, secrets, Cloudflare). Human-run, never an agent.

Supporting docs: the [guardrail roadmap](docs/guardrail-roadmap.md) (Phase 6.5
safety status — what shipped, what's still open), the
[safeguarding runbook](docs/safeguarding/csam-grooming-escalation.md), and the
product's own [legal / guardrail ADRs](docs/product-legal-adrs.md).
