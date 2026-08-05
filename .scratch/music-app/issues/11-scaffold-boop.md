# 11 — Scaffold `apps/boop`

**What to build:** A deployable stateless boop app skeleton: visiting the app
in simulator mode shows a placeholder boop page, and every repo wiring
touchpoint is in place so later tickets only add features. Copy base is
`templates/starter` (stateless — no DB, per ADR 0008).

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] `apps/boop` exists, copied from `templates/starter`, package name set
- [x] Port registry row claimed (dev port + CT port) per the adding-an-app
      how-to — take the next free row, don't grep-and-guess
- [x] `fly.toml` app name `hoe-boop`; subdomain `boop.homeofed.com` noted
      (Fly/Cloudflare creation itself stays human-gated)
- [x] CI deploy job copied and adjusted (affected check, fly.toml path,
      smoke URL)
- [x] Compose service added with a fresh host port
- [x] Shallow `/health` (no Store round-trip)
- [x] `apps/boop/CLAUDE.md` scoped rules and `CONTEXT.md` seeded with the
      domain terms (beat event, tick vs step, hit, songPos, kit manifest,
      role)
- [x] Styles scaffolding per the design handoff
      (`docs/reference/boop-design/README.md`): `src/styles/tokens.scss`
      carrying the handoff's design tokens (stage/well/ink/instrument hues,
      radii, shadows), SCSS modules organised like `apps/fridge`
- [x] Chivo + Chivo Mono self-hosted (house rule — no runtime Google Fonts;
      follow the fridge's Fredoka pattern)
- [x] `pnpm lint`, `pnpm typecheck`, and the app's tests green

## Comments

Resolved 2026-08-05 (agent, Sonnet). Landed in `8c598a3` on `music-app`.
Scaffolded from `templates/starter`: port row 3008 (dev) / 3108 (CT) / 8088
(compose) claimed in the registry after checking other worktrees for
collisions; `fly.toml` app `hoe-boop`; `deploy-boop` CI job (stateless smoke
shape); stateless compose service; shallow `/health`; CLAUDE.md + CONTEXT.md
seeded with the domain vocabulary (registered in CONTEXT-MAP.md);
`tokens.scss` carrying the full design-handoff token set; Chivo + Chivo Mono
self-hosted as real latin-subset woff2 files. Starter greeting demo kept
(renamed to boop) as the working layered-path baseline. Gate re-verified by
orchestrator: lint/typecheck clean, vitest 2/2, playwright CT 3/3.
Fly app + Cloudflare creation remain human-gated (go-live runbook).
