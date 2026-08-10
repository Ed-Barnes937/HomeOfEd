# HomeOfEd

[![Deploy](https://github.com/Ed-Barnes937/HomeOfEd/actions/workflows/deploy.yml/badge.svg)](https://github.com/Ed-Barnes937/HomeOfEd/actions/workflows/deploy.yml)
[![Site](https://img.shields.io/website?url=https%3A%2F%2Fhomeofed.com&label=homeofed.com)](https://homeofed.com)
[![Node](https://img.shields.io/badge/node-22-339933?logo=node.js&logoColor=white)](.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](packages/config)
[![Fly.io](https://img.shields.io/badge/Fly.io-London-8b5cf6?logo=flydotio&logoColor=white)](docs/hosting.md)

My personal corner of the internet: a monorepo of small, self-contained web apps
that each get their own subdomain. Some are toys, some are for my kids, some are
excuses to try an idea out properly. They all share the same plumbing and the
same deployment path, and nothing else.

### 👉 [**homeofed.com**](https://homeofed.com)

Live since 2 July 2026, hosted on Fly.io in London behind Cloudflare.

| App | What it is | Status |
|---|---|---|
| [homeofed.com](https://homeofed.com) | The launcher. A card for every app. | ✅ Live |
| [boids](https://boids.homeofed.com) | Reynolds flocking on a full-screen canvas, with knobs to fiddle with. | ✅ Live |
| [boop](https://boop.homeofed.com) | A 6-instrument, 16-step sequencer for children. Tap to paint a beat. | ✅ Live |
| [espy](https://espy.homeofed.com) | Ink blots on warm paper that you doodle into little creatures. | ✅ Live |
| [fridge](https://fridge.homeofed.com) | Fridge magnets that shove each other out of the way as you drag them. | ✅ Live |
| [karesansui](https://karesansui.homeofed.com) | 枯山水. Build a gear train, press play, watch it rake a zen garden. | ✅ Live |
| [silt](https://silt.homeofed.com) | A falling-sand playground. | ✅ Live |
| [wotd](https://wotd.homeofed.com) | Word of the day, at four difficulty levels. | ✅ Live |
| `sprout` | A child-safe LLM chat app for children. | 🚧 Built, awaiting DNS |

## How it is put together

Every app is a leaf node. It owns its own UI, its own styles and its own
backend handlers, and it never imports from another app. Anything genuinely
shared moves into a package instead. That rule is the whole reason the repo
stays workable as it grows.

Apps are React SPAs (TanStack Router, TanStack Query, a tRPC client, SCSS
modules). Data always travels over tRPC, never through server functions,
because tRPC is where the dependency-injection seam lives. Behind the
transport, handlers talk to `Store` and `BlobStore` interfaces rather than to a
database, so the same handler code runs in production against Postgres and in
development against an in-memory PGlite. Server-side rendering is available via
TanStack Start, but you have to opt in and have a reason.

Underneath: TypeScript throughout, Drizzle over Fly Postgres, pnpm workspaces
with Turborepo, Vitest for units and Playwright for whole-frontend tests.

The reasoning for all of the above is written down in
[`docs/adr/`](docs/adr/). [ADR 0001](docs/adr/0001-foundation.md) is the
architectural baseline and the right place to start.

## Layout

```
apps/*              the apps. hub is the launcher.
templates/starter   stateless copy base for a new app (not deployed)
packages/
  config            tsconfig / eslint / prettier base
  db                drizzle client, Postgres↔PGlite swap, migration runner
  backend-kit       handler base, transports, Store/BlobStore, fakes, simulator, DI
  logger            structured JSON logging
  test-kit          playwright fixtures, base page objects, simulator glue
docs/
  adr/              numbered decision records
  plans/            implementation plans
  how-to/           procedures, e.g. adding an app
  runbooks/         human-run infrastructure steps
  hosting.md        hosting and infrastructure
CLAUDE.md           working rules for contributors and agents
```

Each package has a `README.md` covering its purpose, public API and tests. Each
app has a `README.md` and a scoped `CLAUDE.md`.

## Getting started

You need Node 22 (`.nvmrc`), pnpm via corepack, Docker if you want the
container stack, and `flyctl` if you are deploying.

```bash
corepack enable
pnpm install
pnpm dev --filter=hub
```

That last command is how you will spend nearly all of your time. It runs the
frontend, the real backend handlers, PGlite and an in-memory blob store in one
process, with hot reload and no Docker. It is also exactly what the Playwright
tests run against, so a green test suite means something.

The other mode exists to check the real artefact:

```bash
docker compose up hub     # one app plus its database
docker compose up         # everything
```

This builds each app's actual Fly Dockerfile (turbo-pruned, production
dependencies only) and runs it against a `postgres:17` container, executing the
same two steps as a real deploy: migrate, then serve. Hub lands on
<http://localhost:8080> with a deep health check at `/health`. Use it before a
deploy and when you suspect a PGlite-versus-Postgres difference. The database
credentials in `compose.yml` are local throwaways; real secrets go in a
gitignored `.env`.

## Checks

```bash
pnpm test --filter=<app|package>
pnpm lint
pnpm typecheck
```

Three test layers, by suffix. `*.test.ts(x)` is Vitest, for units and
integration. `*.iwft.ts(x)` is Playwright driving the whole frontend against
the simulator, through page objects. `*.e2e.ts(x)` is the full stack and is
currently deferred. Development is test-first: red, green, refactor.

## Adding an app

There is no generator, on purpose. You copy `templates/starter` and change each
wiring touchpoint by hand: name, subdomain, ports, Fly app, Cloudflare record,
CI job, compose service. A database is a separate additive step and plenty of
apps never need one.

The full procedure is in
[docs/how-to/adding-an-app.md](docs/how-to/adding-an-app.md). The rationale is
in [ADR 0007](docs/adr/0007-reference-starter-app.md) and
[ADR 0008](docs/adr/0008-apps-without-a-database.md).

## Deploying

Merging to `main` deploys whichever apps changed. CI runs migrations through the
`release_command` in each `fly.toml`, then smoke-tests `/health`.

Standing up a *brand new* app's infrastructure is scripted, but a human runs it,
because it creates real Fly apps and edits real DNS:

```bash
fly auth login
CLOUDFLARE_API_TOKEN=... scripts/go-live.sh <app> [--db] [--dry-run]
```

Give it the directory name under `apps/`, which is also the subdomain. Add
`--db` if the app needs a database in the shared `hoe-pg` cluster, and
`--dry-run` to print every mutating command without running it. The script is
idempotent, so if a step fails you can fix the cause and re-run from the top.
It also handles the awkward part of the certificate dance for you: the CNAME
goes in DNS-only so Let's Encrypt can see Fly directly, then flips to proxied
once the certificate is issued.

The token needs `Zone.DNS:Edit` on the `homeofed.com` zone, and nothing more.
[docs/runbooks/phase-4-go-live.md](docs/runbooks/phase-4-go-live.md) covers the
manual equivalent and the GitHub secrets, which are still set by hand.

## Where to find things

| Path | What is in it |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working rules, and the add-an-app checklist. |
| [`docs/adr/`](docs/adr/) | Numbered decision records. The why. |
| [`docs/how-to/`](docs/how-to/) | Step-by-step procedures. |
| [`docs/runbooks/`](docs/runbooks/) | Things only a human can do. |
| [`docs/plans/`](docs/plans/) | Implementation plans. |
| [`docs/reference/`](docs/reference/) | Background studies behind the decisions. |
| [`docs/hosting.md`](docs/hosting.md) | Hosting and infrastructure. |
| `packages/*/README.md` | Per-package API and usage. |
| `apps/*/README.md` | Per-app specifics. |
