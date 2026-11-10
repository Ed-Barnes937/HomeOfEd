# 11 - armoury: per-profile saves, `/shared`, and the gate

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 5-8, 10
Blocked by: 01, 02, 10 (merge after 17)

Copy the merged pattern from ticket 10 (boop), without sync; armoury is not a SaveStore client.

- `armoury:save` (`src/persistence/storage.ts`) goes through
  `profileScopedKey`; `adoptLegacyDocument` on first open. The save format
  (ADR 0074) is untouched.
- `/shared`: decodes the existing `#w=` payload (ADR 0075) and shows the wand
  with the workbench usable and nothing persisted. "Keep this wand" links to
  `/#w=...`. Share now produces `/shared#w=...`; picture sharing is unchanged.
  A root `/#w=` link keeps today's behaviour for a signed-in visitor.
- A way to switch player: a link to `accountUrl(<current URL>)` in the app's
  existing chrome, in armoury's own style.
- Gate wiring in `main.ts` with `publicPaths: ['/shared']`, and
  `FAMILY_ACCOUNT_URL` in `fly.toml`. Not `compose.yml` or `deploy.yml`.
- iwft: per-profile shelf, legacy adoption, `/shared` writes nothing. Update
  `apps/armoury/CLAUDE.md`; amend ADR 0075.

## Comments

**2026-11-10, built (one PR).** Differences from the text above, and why:

- Gate wiring follows ticket 10's pattern: `main.ts` calls
  `familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] })`, the
  Dockerfile takes the four README steps, and `fly.toml` is untouched, so the
  gate stays off in production (spec, "For implementers"). A new
  `src/server/main.test.ts`, copied from the starter, boots the entrypoint on a
  real port and also proves `/shared` is not gated.
- The workbench used to sit above the router, so `/` and `/shelf` shared one
  provider over `window.localStorage`. It now sits under a pathless `player`
  layout route (`views.tsx`, `PlayerView`) that builds `profileStorage` and
  calls `reloadOnPlayerChange`; `/shared` (`SharedView`) gets its own
  workbench over `memoryStorage`. `App` lost its unused `storage` prop.
- On `/shared` the existing primary button keeps its words, "Keep this wand",
  but goes to `/#w=...` with the wand as it is now (`keepFragment`, byte for
  byte when nothing changed), as boop's keep does. It is a button that
  navigates on press, not a link, because the URL depends on the wand at that
  moment. The header drops the shelf and the player chip there; Share and
  Picture stay. The fragment stays in the address bar, so a reload reopens the
  share.
- The switch-player link is a chip in the header's nav, in the shelf button's
  style: a person icon and the player's name, linking to
  `switchPlayerUrlFor(location.href)`. It shows only with a session, and
  outside the estate (the `.iwft` port) it is the name alone. On the phone it
  is icon only, like the other header buttons. With the chip, the motto hides
  below 1340px so the nav keeps one line.
- The back arrow now uses `hubUrlFor`, replacing armoury's own `hubUrl`
  (which pointed every localhost port at `localhost:3000`).
- Only ADR 0075 is amended. `apps/armoury/CONTEXT.md` gained Player and Shared
  view.

Docker stack (`family hub armoury`, project `hoe11`, torn down with `-v`),
Chromium 149 and Playwright WebKit 26.5, all passing:
`docker-stack-gate-round-trip.mjs http://localhost:8091` with
`FRAGMENT='#w=%7B%22a%22%3A1%7D'` (12 checks per browser). Also by script in
both browsers: a real `/shared#w=` wand opens signed out with no shelf or chip,
an edit and a reload write nothing, Keep goes through the gate and the pick,
and the edited wand lands in `armoury:save@<accountId>` as the only key; the
chip links to `http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8091%2F`
and the back arrow to `http://localhost:8080`.
