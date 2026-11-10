# 13 - espy: per-profile doodles and the gate

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 3, 7, 8, 10
Blocked by: 01, 02, 10 (merge after 17)

- Scope the doodle save (`src/features/doodle/useDoodle.ts`, `save.ts`) per
  profile through `profileScopedKey`; `adoptLegacyDocument` on first open. If
  doodles are large, apply ticket 12's measure-first rule and report.
- The Capacitor shell loads bundled assets and has no family cookie: a null
  session keeps the unscoped key, so the native app behaves exactly as today.
  Add a test that pins this.
- `save.ts` references `location.hash`; establish whether espy has a share
  link at all. If it does, give it a `/shared` route as in ticket 10; if not,
  say so in the PR and add no public path.
- A switch-player link to `accountUrl(<current URL>)`, hidden in the native
  shell.
- Gate wiring in `main.ts` and `FAMILY_ACCOUNT_URL` in `fly.toml`. Not
  `compose.yml` or `deploy.yml`. Update `apps/espy/CLAUDE.md`.

## Comments

**2026-11-10, built (one PR against `estate-gate/tracker`).** Differences from
the text above, and why:

- **No share link.** `save.ts` never touches `location.hash`; Save hands a PNG
  to the share sheet or a download. So there is no `/shared`, `main.ts` passes
  `familyDocumentGateFromEnv(process.env, { publicPaths: [] })`, and nothing
  reads `arrivalFragment()`.
- **`fly.toml` untouched**, per the orchestrator and ticket 19: the gate stays
  off in production. The Dockerfile follows `packages/accounts/README.md`.
- **The native shell does not rely on lacking a cookie.** `App.tsx` reads the
  session as `null` whenever `Capacitor.isNativePlatform()`, and the page runs
  no `reloadOnPlayerChange` there. `nativeShell.iwft.tsx` pins it with a family
  cookie present: unscoped key, no player shown, no reload on a player change.
  ADR 0094 amended.
- **The back arrow uses `hubUrlFor` on the web** (pattern step 5), so in the
  compose stack it points at `localhost:8080` rather than `localhost:3000`.
  Inside the native shell it keeps espy's own `hubUrl(hostname)`, exactly as
  before this ticket, and `nativeShell.iwft.tsx` pins that.
- **The switch-player link** is the player's name in a pill at the header's
  right, linking to `switchPlayerUrlFor(location.href)`. Outside the estate
  (the `.iwft` port) it is the name alone, as boop's chip is.
- **`src/server/main.test.ts`** copied from the starter: the real entrypoint
  on a real port, gate off and on.
- **`scripts/docker-stack-gate-round-trip.mjs`** gained `NO_SHARED=1`, which
  skips the `/shared` step and checks that `/shared` is gated and an asset path
  is not.

**Pre-existing, for a later ticket (not changed here).**

- **The native back arrow is a dead link.** The Capacitor shell's hostname is
  `localhost`, so `hubUrl` sends the arrow to `http://localhost:3000`, which is
  nothing on a phone. It was so before this ticket and is kept so, because the
  shell must behave exactly as today. `hubUrlFor` would give
  `https://homeofed.com`.
- **Deep links and `base: ''`.** espy builds with relative asset URLs for the
  shell, so a document at a deep path (the gate round trip's
  `/some/deep/path`) gets `index.html` with `./assets/...` resolving under that
  path. The gate returns a visitor to the exact URL they asked for, so a
  deep-linked espy URL probably loads a broken page after sign-in. Visitors
  normally land on `/`, and a deep link was already broken before the gate.

**Measured (kept as built: every profile adopts; the orchestrator is raising
the drawing size with Ed).** One slot, `espy:doodle:v2`, holding the
whole undo history, which survives reloads. Chromium quota: 5,242,880
characters per origin. A fresh drawing is 22-31 KB (390x844 to 1920x1080), a
stroke about 120 characters, and every New page adds 21-37 KB (each page keeps
its baked ink raster). Four copies (legacy plus three profiles) fit while the
slot is under about 1.3 MB, roughly 40 New pages at laptop size. The slot has
no bound except the quota: when a save meets it, `session.ts` falls back to a
stripped copy (one raster, about 45 KB after six pages). Past about 1.3 MB a
later profile's adoption fails and is retried; and a legacy slot near the
quota, which is never rewritten, could leave too little room for a profile's
stripped save. Built with the default adoption; options for Ed: keep it, only
the first profile adopts (ticket 12's fallback), or have `session.ts` always
persist only the current page's raster, which bounds a slot near 30 KB plus
about 3 KB per page (undo past a New page after a reload then shows plain blots
for older pages).
