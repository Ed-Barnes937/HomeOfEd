# 0095 - hub returns a visitor to the app that sent them, from the URL they arrived on

- **Status:** Proposed (decision 6 departs from the ticket and is an open call for
  Ed; decision 12, the parent session's lifetime, added by ticket 06, is answered
  by [ADR 0070](0070-family-service.md)'s 2026-11-12 amendment)
- **Date:** 2026-11-10
- **Related:** [ADR 0081](0081-hub-account-ui.md) (the `/account` screens this
  extends), [ADR 0078](0078-family-identity-auth-boundary.md) (the identity
  boundary), [ADR 0094](0094-per-profile-local-saves.md) (per-profile saves),
  ADR 0093 (the estate gate that sends visitors here). Implements estate-gate
  ticket 05, decisions 4 and 6 of
  [the estate-gate spec](../../.scratch/estate-gate/spec.md); ticket 06 (silent
  renewal) amends it. [ADR 0103](0103-account-picker-and-settings.md) amends
  decision 1 (`/account/settings` counts as the arrival's page) and adds the
  go-home rule after a pick with nowhere to return to.

## Context

Every gated app answers a signed-out visitor's document request with a `302` to
`https://homeofed.com/account?returnTo=<the URL they wanted>`. A browser keeps the
original URL's fragment across a redirect that names none, so hub loads as
`/account?returnTo=https%3A%2F%2Fboop.homeofed.com%2F#g=abc`, with a share
payload, if there was one, on hub's own URL.

The visitors are parents and young children. The return has to feel like nothing
happened. And `returnTo` is attacker-controlled input on the one page where
parents type a password, so an open redirect here would be a real vulnerability.
`@hoe/accounts` already owns the URL rules (`safeReturnTo`, `sharedUrl`, from
estate-gate ticket 01); this ADR is about how hub uses them, and hub reimplements
none of them.

## Decision

**1. The arrival URL is captured once, at module load, before the router touches
it.** TanStack Router's `Transitioner` rewrites the address bar on mount to its
own canonical form (`commitLocation({ replace: true })`): it JSON-parses search
values, so a duplicated `returnTo` becomes a JSON array, and it decodes the
fragment, so `#w=%7B%7D` becomes `#w={}`. Reading `window.location` after mount
would hand the app a different fragment from the one it sent. So `returnTo.ts`
records `pathname`, `search` and `hash` when it is first evaluated, which is
before any component mounts, and reads `returnTo` from that raw search with
`URLSearchParams`. A `returnTo` given more than once is refused, not resolved.

The capture is in memory only, so it ends with the document. It is honoured only
while the address bar is still on the arrival's path and still carries exactly one
`returnTo`, equal to the one captured, so a later client-side move to `/account`
(the home page's who's-playing chip) never inherits it, and nor does a move to an
address carrying a different `returnTo`. The paths are compared without trailing
slashes, because the router rewrites an arrival on `/account/` to `/account` on
mount and the return would otherwise fail silently (`stillOnArrival`). Sign-in and registration are `fetch` calls,
so nothing between arriving and picking leaves the page. Nothing is stored, and
`safeReturnTo` runs on the raw value at the moment of use.

Rejected: `sessionStorage`, which outlives the visit inside the same tab and
would put a value hub then has to decide whether to trust; and reading the
address bar at use time, which sees the router's rewrite.

**2. One place returns the visitor.** `returnToApp(written)` in
`apps/hub/src/features/account/returnTo.ts` is a plain function, beside
`sharedLink()`. It takes the claims the pick just wrote, vets `returnTo` with
`safeReturnTo` at that moment, and navigates only to what that returns; anything
refused means no navigation and `false`. The cards call it and know nothing else
about returning, so ticket 06's renewal calls the same function with the claims
it wrote, and tickets 08 and 09 can change their cards without meeting this logic.

**3. The fragment is reattached byte for byte, after a `#`.** `returnDestination`
appends the fragment exactly as it was in the arrival URL to the fragment-free URL
`safeReturnTo` returns. A URL parser in its fragment state consumes everything to
the end of the string, so no fragment can move the origin, path or query; the unit
tests name the hostile shapes (`#@evil.example/`, `#/../..`, backslashes, a second
`#`, a newline before a scheme, a query), and an `.iwft` that first loads on a
percent-escaped fragment checks it reaches the app unchanged. Hub never inspects
the fragment, so it needs no knowledge of any app's share format.

**4. `allowLocal` follows the hostname exactly as the cookie's `Domain` does**
(ADR 0081 decision 3): `returnToOptions(hostname)` in `familyService.ts` shares
`isLocal` with `familySessionCookieOptions`. A hub on `homeofed.com` can never
return anyone to `localhost`.

**5. The return follows a cookie that reads back, and replaces the history
entry.** `returnToApp(written)` returns only when `written` is not null (that is,
`writeFamilySession` accepted the token: decodable and not expired by this
device's clock) **and** the cookie read back has the same `sub` and `iat` as
`written`, meaning the browser really kept this write. `sub` alone is not enough:
an older cookie for the same profile, still in the jar, would pass for a fresh
write the browser dropped. `writeFamilySession` assigns `document.cookie` and
cannot see a write the browser drops. Without that check, a dropped cookie would
send the visitor into the gate, back here, and, once ticket 06's silent renewal
skips the screen, round again forever. Navigation is `location.replace`, so the
back button from the app does not land on hub's account page.

**6. Arriving with a live family session shows the page; it does not return
immediately.** The ticket asked for an immediate return. That is not built,
because hub cannot reach that state through the gate working correctly:

- The gate redirects only when it cannot verify a token. A visitor who reaches
  hub with a token hub can decode came either from an app's **switch-player
  link** (spec decision 10, which uses the same `accountUrl` shape on purpose) or
  from a **disagreement** between the gate and hub, such as an app verifying with
  the wrong public key (ticket 19 names exactly this loop), clock skew, or a
  token signed by another environment.
- An immediate return makes switching player impossible: the chip would bounce
  straight back to the app.
- In a disagreement it spins between the app and hub with no screen at all,
  because `readFamilySession` is decode-only and hub cannot know the gate will
  refuse what it decodes.

So the page shows, the picker marks who is playing now, and any pick, including
the same profile again, returns. The case that genuinely deserves no screen, a
parent signed in at hub whose child's token has expired, is ticket 06's silent
renewal, which calls `returnToApp()` after re-minting.

**7. "Open what was shared" shows whenever nobody is signed in**, rendered by
`AccountPage` when a fragment came along and `sharedUrl` accepts `returnTo`, and
linking to `<origin>/shared<fragment>`. That includes while `identity.me` is
loading and when the family service is down, because `/shared` needs no account
and a share should not depend on family being up. A signed-in parent does not see
it; they can pick and get the full app. A refused `returnTo` drops the link along
with the return, and hub behaves exactly as if no `returnTo` had been given; it
shows no warning, because a parent cannot act on one.

## Amendment (2026-11-10, ticket 06): silent renewal

Spec decision 11. A family token lives 30 days and nothing renewed it, so a gated
child met a parent-password wall every month. On Safari it is worse: Safari caps
cookies written by script (`document.cookie`) at 7 days, and hub writes the family
cookie from script (ADR 0081 decision 3), so on an iPad the cookie vanishes weekly
whatever its `Max-Age` says. Silent renewal is what keeps a child playing there.

**8. Hub remembers the last pick on this device.** `hub.rememberedProfile` in
`localStorage` holds the account id (the parent's or a child profile's) of the
last pick whose cookie write succeeded. It is forgotten on sign-out, on household
erase, and when that profile is deleted here. It is not forgotten when a renewal
finds the profile gone (deleted on another device, or another parent signed in):
that case only falls through, which is cheap. The id is not a credential; minting
still needs the parent's cookie session.

**9. Renewal is tried only on an arrival that can use it, once per document, and
shows no screen.** All of: a `returnTo` that `safeReturnTo` accepts on the arrival
(decision 1), **no** family cookie, and a remembered profile. With a live cookie
the arrival is an app's switch-player link, and decision 6 applies: the picker
shows. While renewal runs, `AccountPage` renders the paper (`aria-busy`) and
nothing else but "Open what was shared" when decision 7 offers it, because a share
must not wait on the family service. So on the success path that link can show
briefly before the visitor leaves; hiding it would bring back a blank page for as
long as the time box when the service does not answer. It then needs `identity.me` to name a parent
and, for a child, `children.list` to still return the remembered id; then
`mintSessionToken`, `writeFamilySession`, and `returnToApp(written)` from decision
2, so the return keeps decision 5's read-back.

Renewal makes one call of each, with no retries, inside a 2-second time box; past
it, nothing more is minted, written or navigated, and the normal page shows. The
page's own `me` query waits for renewal rather than racing it, since its retries
would otherwise hold a down service's visitor on a blank page for seconds. Anything
else, including any failure, falls through to the normal page, which is handed the
`me` and `children` answers renewal fetched within the box: they go into the query
cache, and both queries keep a plain 5-second `staleTime` (`FAMILY_STALE_MS`), so
the page does not ask again. Every change still reaches the screen because every
change invalidates: profile add, edit and delete invalidate `children`, and a
sign-in or registration now invalidates every family query, so a parent signing
back in is not shown the empty list sign-out wrote. The attempt is held once
per document (`renewSilently`), so React's StrictMode double effect cannot mint
twice.

**10. The loop guard.** If an app's gate refuses a token hub just minted (wrong
verifying key, clock skew, another environment's token), the visitor arrives
straight back, and decision 9 would bounce them between app and hub with no
screen. So `hub.silentRenewal` in `sessionStorage` maps each `returnTo` to when it
was last renewed silently, written just before the mint; a second arrival for the
same `returnTo` within 60 seconds shows the normal page. `sessionStorage` because
the loop is in one tab and the record should die with it. A device clock reading
earlier than the record counts as inside the window, and storage that cannot be
read, or a record that cannot be written, means no silent renewal, since a loop
could not be seen.

The guard is the backstop for any disagreement between hub and a gate, and the
gate cannot settle one on its own, because it never clears a cookie it refuses. One known route: a device clock ahead of a token's `exp` makes
`readFamilySession` discard a cookie the gate still accepts, so an app's
switch-player link arrives looking token-less and re-mints silently, once, instead
of showing the picker; the guard turns the second arrival into the page.

**11. Rejected: renewing after a sign-in on the page.** A parent who signs in
while a `returnTo` is present sees the picker, as before. Skipping it would return
them as whoever was last picked, which is a choice they did not make on that
screen.

**12. The parent session lifetime is 7 days and does not slide in the browser
(open call for Ed, not changed).** `apps/family/src/server/auth/betterAuth.ts`
sets no `session` option, so Better Auth 1.6.23's defaults apply: `expiresIn` 7
days, `updateAge` 1 day. Checked against `docker compose up family` on
2026-11-10:

- Sign-up answers `Set-Cookie: better-auth.session_token=...; Max-Age=604800;
  HttpOnly; SameSite=Lax`: 7 days, shorter than the family token's 30.
- The session row slides, the cookie does not. With the row aged two days,
  `identity.me` over tRPC extended the row's `expires_at` to 7 days from then but
  sent **no** `Set-Cookie`, because `resolveParentId` calls `auth.api.getSession`
  server-side and the refreshed cookie is dropped. `/api/auth/get-session`, which
  nothing calls, did send one.

So the browser forgets the parent 7 days after sign-in however often hub is
used, and silent renewal stops working from then until the parent signs in again.
On an iPad, with the family cookie also capped at 7 days, the two run out at about
the same time, so in practice a parent there signs in roughly weekly. Fixing it
(a longer `expiresIn`, relaying the refreshed cookie, or hub calling
`get-session`) changes the family service's auth and is left for Ed.

Not checked here: whether Safari also caps this server-set, httpOnly cookie in
some deployments; Safari's documented cap is on script-written cookies.

**Answered 2026-11-12 (estate-gate ticket 22):** the parent session now lasts 90
days and slides, and its refreshed cookie reaches the browser on tRPC replies;
see [ADR 0070](0070-family-service.md)'s amendment of that date, which also
records the lost-device cost. Silent renewal therefore keeps working for as long
as the device is used at least once every 90 days. The Safari question stays
open there.

## Consequences

- A refused `returnTo` is silent. If the gate ever sends one `safeReturnTo`
  refuses, the visitor lands on `/account` and stays there after the pick, which
  is a stuck visitor rather than an open redirect. `accountUrlFor` already refuses
  to build such a link, so only the gate's own URL could.
- On a local hub, production `returnTo` values are accepted as well as localhost
  ones, because `safeReturnTo` adds the local origins rather than swapping. The
  `.iwft` suite relies on that, routing `https://*.homeofed.com` to a stub page.
- The `.iwft` sets the arrival URL before mounting, so the app and its router first
  load on it as a visitor's do, but it is not a real `302`. That was checked
  separately on 2026-11-10 (results below).
- For one frame after a pick, the who's-playing card shows the new player before
  the browser leaves.
- **Every gated app's own router rewrites its own fragment the same way.** In the
  docker stack, hub handed boop `#w=%7B%22a%22%3A1%7D&g=abc-123` exactly, and
  boop's address bar then read `#w={%22a%22%3A1}&g=abc-123` once boop's TanStack
  Router mounted. Any app that reads its share payload from `location.hash` after
  mount must either capture it first, as hub does, or accept the decoded form.
  That is the app tickets' concern (10 to 15), not hub's.

## What was checked against real browsers (2026-11-10)

- **A fragment survives a server `302`.** A tiny Node server answered
  `/play?bank=2#w=%7B%22a%22%3A1%7D&g=abc-123` with `302 Location:
  /account?returnTo=...` (no fragment in `Location`). Playwright WebKit 26.5 and
  Chromium 149 both landed on `/account?returnTo=...` with the hash unchanged,
  byte for byte. This is Playwright's WebKit build, not Safari itself.
- **Hub's production build, in the docker stack (`family hub boop`), against the
  real family service**, first-loaded on
  `http://localhost:8080/account?returnTo=http%3A%2F%2Flocalhost%3A8088%2F%3Fx%3D1#w=%7B%22a%22%3A1%7D&g=abc-123`,
  in Chromium and WebKit: the router rewrote hub's own address bar to
  `#w={%22a%22%3A1}...` as decision 1 expects; the signed-out page offered
  `http://localhost:8088/shared#w=%7B%22a%22%3A1%7D&g=abc-123`; registering and
  picking navigated to `http://localhost:8088/?x=1#w=%7B%22a%22%3A1%7D&g=abc-123`,
  byte for byte (boop's document stubbed, to see what hub sent before boop's router
  ran); and going back did not land on `/account`. Boop's gate itself is not built
  yet (tickets 02 and 10), so the `302` in that run was the Node server's, not
  `createAppServer`'s.
