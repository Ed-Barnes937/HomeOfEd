# 02 — Scaffold `apps/silt` from starter

**What to build:** A bootable Silt app shell wired into the monorepo. Copy the
stateless baseline `templates/starter` (per ADR 0007/0008 — no database) and
walk every wiring touchpoint in the root CLAUDE.md "Adding an app" checklist
and `docs/how-to/adding-an-app.md`:

- App name `silt`, subdomain `silt.homeofed.com`, Fly app `hoe-silt`
- **Ports:** take the next-free row from the port registry in the how-to and
  add `silt` to it. Do not grep-and-guess — check unmerged branches too (the
  registry is known to be stale: `espy` is live but unlisted)
- `fly.toml`, CI deploy job (copied from `deploy-hub`: affected check,
  fly.toml path, smoke URL), compose service (one service, no `DATABASE_URL`,
  no `depends_on`, fresh host port)
- Shallow `/health` (no Store round-trip), scoped `apps/silt/CLAUDE.md`
- A placeholder home page (the engine comes later)

Writing `fly.toml`/CI/compose is in scope; *applying* infra (fly/Cloudflare)
is not — that's ticket 11.

Spec: `.scratch/sand-sim/spec.md` §2.

**Blocked by:** None — can start immediately

**Status:** resolved

- [x] `pnpm dev --filter=silt` serves the placeholder page in simulator mode on the claimed dev port
- [x] Port registry updated with silt's dev/CT/compose rows
- [x] `/health` responds ok without a database
- [x] CI job and compose service exist and mirror the stateless pattern
- [x] `pnpm lint`, `pnpm typecheck`, and silt's tests are green

## Comments

Resolved across commits `a2031cb` (scaffold content — swept into the tracker
commit via a shared-index race with ticket 01; all apps/silt files) and
`acbc9b6` (deploy-silt CI job, compose service, port registry) — Sonnet agent.
Ports claimed: **3009 dev / 3109 CT / 8089 compose**, verified free against
main's real per-app ports and all unmerged branches (`boop` on origin/music-app
holds 3008/3108/8088). Deviation worth noting: the agent also corrected the
registry's stale `hirameki` row to `espy` (3006/3106/8086) — a pre-existing
registry error, fixed because the ticket explicitly called the registry stale.
Orchestrator re-ran the gate: silt lint/typecheck clean, vitest 2/2,
playwright CT 3/3; fly.toml `hoe-silt`, compose service (no DATABASE_URL, no
depends_on), and deploy-silt job all present.
