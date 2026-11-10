# 10 - boop: per-profile saves, always-on sync, `/shared`, and the gate

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decisions 2, 5-10
Blocked by: 01, 02 (merge only after 05 is live)

The first gated app and the reference the other app tickets copy. Ship as
stacked PRs in this order if one PR gets too large.

1. **Per-profile saves.** `boop:save` and `boop:favourites` go through
   `profileScopedKey` with the account from `readFamilySession()`;
   `adoptLegacyDocument` runs on first open. Hints and other device
   preferences stay unscoped. The frozen `boop:save` v1 format (ADR 0025) is
   untouched; only the key it is stored under changes.
2. **Sync is always on for a signed-in profile.** Remove the import offer,
   the decline path and `boop:syncedAccount` handling from `src/sync/`. Pull,
   merge hook and push stay as ADR 0080 describes; the SaveStore `slotKey`
   stays `boop:save`. Amend ADR 0080.
3. **`/shared`.** A new route that decodes the existing `#g=` payload and
   opens it with persistence and sync switched off: the visitor can play and
   edit, nothing is written. "Keep this boop" links to `/#g=...`. The Share
   action now produces `/shared#g=...`. A root `/#g=` link keeps today's
   behaviour for a signed-in visitor. Decode stays total (ADR 0026).
4. **The chip** links to `accountUrl(<current URL>)` so switching player
   returns here.
5. **Gate.** `main.ts` passes `familyDocumentGate({ accountUrl, publicPaths:
   ['/shared'] })` when `FAMILY_ACCOUNT_URL` is set; add it to `fly.toml`
   `[env]` as `https://homeofed.com/account`. Do not touch `compose.yml` or
   `deploy.yml` (ticket 03).

iwft: profile A's boops are not profile B's; legacy boops appear for both;
`/shared` writes nothing to `localStorage`; keep-this carries the fragment.
Finish with the docker-stack round trip (`family hub boop`): signed out ->
redirected -> sign in -> pick -> back on boop, and a `/shared` link opening
with no session. Update `apps/boop/CLAUDE.md`.

## Comments

**2026-11-10, built (one PR, stacked on ticket 19).** Differences from the
text above, and why:

- Gate wiring follows the orchestrator and ticket 19: `main.ts` calls
  `familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] })`, and
  `fly.toml` is untouched, so the gate stays off in production. The Dockerfile
  follows `packages/accounts/README.md` (including dropping
  `packages/accounts/src/testing` from the image).
- The shared view needed UI the ticket does not describe. On the laptop bar
  "Keep this boop" stands where New boop and My boops were; on the phone the
  save icon becomes the keep link and the menu drops New boop and My boops.
  Both reuse existing styles. Nothing on `/shared` offers to save, because
  nothing there can be kept.
- "Keep this boop" carries the fragment the shared view opened on, byte for
  byte (spec decision 6), so a visitor's edits on `/shared` are not kept. Open
  question for Ed.
- The chip links to `accountUrlFor` on the current URL **without** its
  fragment: boop has already loaded it, and replaying it would reopen a share
  over the next player's work.
- The back arrow uses the estate registry too, so hosts outside it (a Fly
  preview, `127.0.0.1`) now point at the production hub rather than
  `localhost:3000`.
- `scripts/docker-stack-sign-in.mjs` lost the offer click and gained
  `registerWithChild(page)`, for a flow the gate started.
  `scripts/docker-stack-gate-round-trip.mjs` is new: the round trip below as a
  rerunnable check for any gated app.
- ADR 0026 got a short amendment as well as 0080, because the share link's path
  changed.

Docker stack (`family hub boop`, project `hoe10boop`), Chromium 149 and
Playwright WebKit 26.5, all passing: a signed-out
`/some/deep/path?x=1#g=%7B%22a%22%3A1%7D` gets the gate's `302` (no-store) to
hub with `returnTo`; hub loads with the fragment intact; register, add a
child and pick send the browser back to the same URL, fragment byte for byte;
`/shared` opens signed out and leaves `localStorage` empty, even after a
reload; `/`, but not the bundle, `/api` or `/health`, is gated. Also checked by
hand in both browsers: share from a signed-in boop gives `/shared#g=...`, a
signed-out visitor opens it, Keep goes through the gate and the pick to `/`, and
the kept boop lands in `boop:save@<accountId>`. The chip and back arrow point at
`localhost:8080`.

**Pattern for the other apps (tickets 11-15).** Copy these, adjusting keys and
payload prefix:

1. **Server.** In `src/server/main.ts`, add `documentGate:
   familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] })` from
   `@hoe/accounts/server` (fridge adds `'/b/'`). Apply the four Dockerfile
   steps in `packages/accounts/README.md` ("Wiring the gate in an app"). Leave
   `fly.toml` alone.
2. **Per-profile storage.** Copy `apps/boop/src/persistence/profileStorage.ts`
   (`profileStorage(device, accountId)` and `memoryStorage()`) with the app's
   own `PROFILE_KEYS` (saves only, never device preferences), plus
   `SaveStorageContext.tsx`. Route components build it, as in
   `apps/boop/src/pages/views.tsx`: `/` gets
   `profileStorage(window.localStorage, readFamilySession()?.sub ?? null)` and
   `/shared` gets `memoryStorage()` (and no save client, if the app syncs).
   Then replace every `window.localStorage` that touches a save with
   `useSaveStorage()`. Building `profileStorage` copies the legacy documents
   in, so never build it on `/shared`.
3. **Fragment.** Copy `apps/boop/src/share/arrival.ts` and read the payload
   through `arrivalFragment()`, never `location.hash` after mount, because
   TanStack Router decodes the address bar.
4. **Links.** Share builds `${origin}/shared${payload}`; "Keep this" is
   `${origin}/${arrivalFragment()}` (`keepSharedUrl` in `shareLink.ts`). Copy
   `apps/boop/src/hubUrl.ts` for the back arrow (`hubUrl(location.href)`) and
   any switch-player link (`switchPlayerUrl(location.href)`, null outside the
   estate). Add no port literals.
5. **Unit tests:** `profileStorage.test.ts` (scoping, pass-through, copy not
   move, no throw), `arrival.test.ts`, `hubUrl.test.ts` (prod, dev, stack,
   outside), and the share URL builders.
6. **`.iwft`:** `profiles.iwft.tsx` (one player's saves are not another's;
   legacy saves appear for both and the legacy key is unchanged) and
   `sharedView.iwft.tsx` (snapshot all of `localStorage` before mounting on
   `/shared`, edit, wait past the autosave, and compare again after a
   reload; keep link byte for byte with a percent-escaped fragment put in the
   address bar with `history.pushState` before `mountApp`; a root link still
   opens for a signed-in player). The POM helper is `HomePagePom.openAt`.
   Seed a profile with the cookie, as `testing/familySession.ts` does.
7. **Stack:** `docker compose -p <name> up -d --build family hub <app>`, then
   `node scripts/docker-stack-gate-round-trip.mjs http://localhost:<composePort>`
   (`FRAGMENT='#w=...'` for another prefix), then tear down. Each run
   registers parents, and Better Auth's sign-up rate limit falls back to one
   shared bucket in the stack, so leave about a minute between runs.
