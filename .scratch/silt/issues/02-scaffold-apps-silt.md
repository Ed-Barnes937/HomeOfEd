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

**Status:** claimed

- [ ] `pnpm dev --filter=silt` serves the placeholder page in simulator mode on the claimed dev port
- [ ] Port registry updated with silt's dev/CT/compose rows
- [ ] `/health` responds ok without a database
- [ ] CI job and compose service exist and mirror the stateless pattern
- [ ] `pnpm lint`, `pnpm typecheck`, and silt's tests are green
