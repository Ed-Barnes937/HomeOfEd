# 0095 - hub returns a visitor to the app that sent them, from the URL they arrived on

- **Status:** Proposed (decision 6 departs from the ticket and is an open call for Ed)
- **Date:** 2026-11-10
- **Related:** [ADR 0081](0081-hub-account-ui.md) (the `/account` screens this
  extends), [ADR 0078](0078-family-identity-auth-boundary.md) (the identity
  boundary), [ADR 0094](0094-per-profile-local-saves.md) (per-profile saves),
  ADR 0093 (the estate gate that sends visitors here). Implements estate-gate
  ticket 05, decisions 4 and 6 of
  [the estate-gate spec](../../.scratch/estate-gate/spec.md); ticket 06 (silent
  renewal) amends it.

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
while the address bar is still on the arrival's path and still carries a
`returnTo`, so a later client-side move to `/account` (the home page's
who's-playing chip) never inherits it. Sign-in and registration are `fetch` calls,
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
device's clock) **and** `readFamilySession()?.sub === written.sub`, meaning the
browser really kept the cookie. `writeFamilySession` assigns `document.cookie` and
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
