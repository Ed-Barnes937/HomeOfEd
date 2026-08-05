# 11 — Scaffold `apps/boop`

**What to build:** A deployable stateless boop app skeleton: visiting the app
in simulator mode shows a placeholder boop page, and every repo wiring
touchpoint is in place so later tickets only add features. Copy base is
`templates/starter` (stateless — no DB, per ADR 0008).

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `apps/boop` exists, copied from `templates/starter`, package name set
- [ ] Port registry row claimed (dev port + CT port) per the adding-an-app
      how-to — take the next free row, don't grep-and-guess
- [ ] `fly.toml` app name `hoe-boop`; subdomain `boop.homeofed.com` noted
      (Fly/Cloudflare creation itself stays human-gated)
- [ ] CI deploy job copied and adjusted (affected check, fly.toml path,
      smoke URL)
- [ ] Compose service added with a fresh host port
- [ ] Shallow `/health` (no Store round-trip)
- [ ] `apps/boop/CLAUDE.md` scoped rules and `CONTEXT.md` seeded with the
      domain terms (beat event, tick vs step, hit, songPos, kit manifest,
      role)
- [ ] Styles scaffolding per the design handoff
      (`docs/reference/boop-design/README.md`): `src/styles/tokens.scss`
      carrying the handoff's design tokens (stage/well/ink/instrument hues,
      radii, shadows), SCSS modules organised like `apps/fridge`
- [ ] Chivo + Chivo Mono self-hosted (house rule — no runtime Google Fonts;
      follow the fridge's Fredoka pattern)
- [ ] `pnpm lint`, `pnpm typecheck`, and the app's tests green
