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
- **"Keep this boop" keeps what the visitor has now, edits included. This
  refines spec decision 6** ("the same fragment"), at the orchestrator's call.
  If the boop still encodes as it did when `/shared` opened, the keep carries
  the arrival fragment byte for byte; otherwise it re-encodes the current boop
  with the share codec (`keepFragment` in `shareLink.ts`). It is a button that
  navigates on press, not a link, because the URL depends on the boop at that
  moment. The largest possible boop encodes to about 68,000 characters and
  went through the gate, hub and the pick in Chromium and WebKit intact (ADR
  0026 amendment).
- The chip links to `switchPlayerUrlFor`, which is `accountUrlFor` on the
  current URL **without** its fragment: boop has already loaded the fragment,
  and replaying it would reopen a share over the next player's work.
- The generic parts are now in `@hoe/accounts`, not boop: `profileStorage`,
  `memoryStorage`, `arrivalFragment`, `hubUrlFor` and `switchPlayerUrlFor`.
  boop keeps its key list (`persistence/profileKeys.ts`), the storage context,
  the routes and the keep logic.
- The back arrow uses the estate registry too, so hosts outside it (a Fly
  preview, `127.0.0.1`) now point at the production hub rather than
  `localhost:3000`.
- `scripts/docker-stack-sign-in.mjs` lost the offer click and gained
  `registerWithChild(page)`, for a flow the gate started.
  `scripts/docker-stack-gate-round-trip.mjs` is new: the round trip below as a
  rerunnable check for any gated app.
- ADR 0026 got a short amendment as well as 0080, because the share link's path
  changed.
- **Review round (2026-11-10).** These came out of review, beyond the ticket
  text:
  - Sync is bound to the profile the page opened for, in three layers. The
    service refuses a mismatched `expectedAccountId` (ADR 0079 amended). The
    client is bound and stops for good on `SaveAccountMismatchError` (ADR 0080
    amended). The page reloads when another player is signed in
    (`reloadOnPlayerChange`).
  - `profileStorage` takes prefixes and offers the full Storage surface.
  - A full quota during adoption is swallowed and retried on the next open
    (ADR 0094 amended).
- **Review follow-ups (2026-11-10, second round).**
  - `reloadOnPlayerChange` moved from `App.tsx` into `PlayerView`, so `/shared`
    never reloads and a visitor keeps their edits.
  - The session is read once, in `App.tsx`, and handed down
    (`sync/FamilySessionContext.tsx`); `views.tsx` and `useBoopSync` no longer
    read the cookie. `App` takes `saveClientFor(accountId)`, and the `.iwft`
    harness passes `bindSaveClient` over the fake.
  - `profileStorage` throws on a profile key that already carries `@`.
  - `bindSaveClient` turns a `CONFLICT` into `SaveAccountMismatchError` only
    when it carries the `SAVE_ACCOUNT_MISMATCH` message. Tests now pin
    `delete`'s `expectedAccountId` and `list`'s pre-send refusal.
- **Open window while the gate is off in production.** A child whose token
  expires plays signed out into the unscoped legacy key. Their profile, which
  already has a document, never adopts that work. It stays on the device and
  is not lost, but they cannot see it under their profile. This is recorded in
  ADR 0094 and not changed. Each app's gate-on PR should follow its per-profile
  PR closely.

Docker stack (`family hub boop`, project `hoe10boop`), Chromium 149 and
Playwright WebKit 26.5, all passing: a signed-out
`/some/deep/path?x=1#g=%7B%22a%22%3A1%7D` gets the gate's `302` (no-store) to
hub with `returnTo`; hub loads with the fragment intact; register, add a
child and pick send the browser back to the same URL, fragment byte for byte;
`/shared` opens signed out and leaves `localStorage` empty, even after a
reload; `/`, but not the bundle, `/api` or `/health`, is gated. Also checked by
hand in both browsers: share from a signed-in boop gives `/shared#g=...`, a
signed-out visitor opens it, changes a step, and Keep goes through the gate
and the pick to `/`; the kept boop, with both the sender's step and the
visitor's change, lands in `boop:save@<accountId>`. The chip and back arrow
point at `localhost:8080`.

**Pattern for the other apps (tickets 11-15).** Call the `@hoe/accounts`
helpers; copy only the app-shaped wiring, adjusting keys and payload prefix:

1. **Server.** In `src/server/main.ts`, add `documentGate:
   familyDocumentGateFromEnv(process.env, { publicPaths: ['/shared'] })` from
   `@hoe/accounts/server` (fridge adds `'/b/'`). Apply the four Dockerfile
   steps in `packages/accounts/README.md` ("Wiring the gate in an app"). Leave
   `fly.toml` alone.
2. **The page's player.** In the app's entry (boop's `App.tsx`), read
   `readFamilySession()` once and hand it down through a context (boop's
   `sync/FamilySessionContext.tsx`); nothing else reads the cookie, so
   storage, the save client and the watcher can never disagree. If the app
   syncs, build `createFamilySaveClient({ baseUrl, accountId: player })` only
   when there is a session, and stop syncing for good on a
   `SaveAccountMismatchError` (boop's `createBoopSync` `onStop`). Take the
   client as a `saveClientFor(accountId)` prop so `.iwft` passes
   `bindSaveClient(fake, accountId)`, bound exactly as production is.
3. **Per-profile storage.** List the app's save keys as boop does in
   `persistence/profileKeys.ts`: `{ keys, prefixes }`, saves only, never device
   preferences. silt's `silt:scene:` and `silt:thumb:` are prefixes. Build the
   storage in the route components, as `apps/boop/src/pages/views.tsx` does:
   - `/` gets `profileStorage(window.localStorage, player, PROFILE_KEYS)`
     and calls `reloadOnPlayerChange(player)` in an effect. Only there: on
     `/shared` a reload would throw away a visitor's unsaved edits.
   - `/shared` gets `memoryStorage()`, and no save client if the app syncs.

   Both offer the whole Storage surface (`removeItem`, `key`, `length`,
   `clear`), and enumeration shows this profile's keys only. A key that
   already carries `@` (`boop:save@<someone>`, or a prefixed key with `@` in
   its remainder) throws. Hand the storage
   down the way boop's `persistence/SaveStorageContext.tsx` does, and replace
   every `window.localStorage` that touches a save with it. Building
   `profileStorage` copies the legacy documents in, so never build it on
   `/shared`. IndexedDB is not covered: scope those keys with
   `profileScopedKey`.
4. **Fragment.** Read the payload through `arrivalFragment()` from
   `@hoe/accounts`, never `location.hash` after mount, because TanStack Router
   decodes the address bar. Read it once, at first render.
5. **Links.** Share builds `${origin}/shared${payload}`. "Keep this" sends the
   item as it is now to `${origin}/`: the arrival fragment when nothing
   changed, else a fresh encoding (boop's `keepFragment` and `keepSharedUrl`
   in `shareLink.ts`, and `keepBoop` in `HomePage.tsx`). The back arrow is
   `hubUrlFor(location.href)` and any switch-player link is
   `switchPlayerUrlFor(location.href)` (null outside the estate: render no
   link). Add no port literals.
6. **Unit tests** in the app: only its own pieces, such as the share and keep
   URL builders. The helpers above are tested in `@hoe/accounts`.
7. **`.iwft`.** Three suites to copy:
   - **`profiles.iwft.tsx`**: one player's saves and favourites are not
     another's; legacy saves appear for both, and the legacy key is unchanged.
   - **`sharedView.iwft.tsx`**: `/shared` writes nothing. Snapshot all of
     `localStorage` before mounting, edit and star, wait past the autosave,
     then compare again after a reload, both signed out and signed in. It also
     checks that:
     - `/shared` keeps its fragment, so a reload reopens the share;
     - Keep with no edits arrives byte for byte, using a percent-escaped
       fragment put in the address bar with `history.pushState` before
       `mountApp`;
     - Keep after an edit carries the edit;
     - a root link still opens for a signed-in player.
   - **`playerChange.iwft.tsx`**: setting another profile's cookie and firing
     `focus` reloads the page, and nothing is written to the other profile's
     key. On `/shared` the same does not reload, and an edit survives.

   The POM helpers are `HomePagePom.openAt` and `keepBoop`. Seed a profile with
   the cookie (`seedFamily`, `setFamilyCookie` in `testing/familySession.ts`).
   For an app that syncs, copy the "a page opened for one profile" block in
   `boopSync.test.ts`.
8. **Stack:** `docker compose -p <name> up -d --build family hub <app>`, then
   `node scripts/docker-stack-gate-round-trip.mjs http://localhost:<composePort>`
   (`FRAGMENT='#w=...'` for another prefix), then tear down. Each run
   registers parents, and Better Auth's sign-up rate limit falls back to one
   shared bucket in the stack, so leave about a minute between runs.
