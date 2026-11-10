# 0095 - hub returns a visitor to the app that sent them, carried by the address bar alone

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

**1. The address bar is the only thing that carries `returnTo`.** Sign-in and
registration are `fetch` calls with `preventDefault` on the form, so hub's URL does
not change between arriving and picking. `returnTo` and the fragment are read from
`window.location` each time they are needed, so they survive a submit, a
re-render and a reload, end with the visit, and are never stored where a later
visit could find them. They are read raw with `URLSearchParams` rather than
through the router, because TanStack Router JSON-parses search values (a
`returnTo` of `123` would arrive as a number).

Rejected: `sessionStorage`, which outlives the visit inside the same tab and
would put a value hub then has to decide whether to trust; and React state
captured at mount, which goes stale on a client-side move to a new `returnTo`.

**2. One place returns the visitor.** `useReturnTo()` in
`apps/hub/src/features/account/returnTo.ts` gives `returnToApp()` and
`sharedLink`. `returnToApp()` re-reads the address bar, runs `safeReturnTo` at that
moment, and navigates only to what it returns; anything refused means no
navigation and `false`. The cards call it and know nothing else about returning,
so ticket 06's renewal calls the same function and tickets 08 and 09 can change
their cards without meeting this logic.

**3. The fragment is reattached as opaque text after a `#`.** `returnDestination`
appends the carried fragment to the fragment-free URL `safeReturnTo` returns. A
URL parser in its fragment state consumes everything to the end of the string,
so no fragment can move the origin, path or query; the unit tests name the
hostile shapes (`#@evil.example/`, `#/../..`, backslashes, a second `#`, a
newline before a scheme, a query). Hub never inspects the fragment, so it needs
no knowledge of any app's share format.

**4. `allowLocal` follows the hostname exactly as the cookie's `Domain` does**
(ADR 0081 decision 3): `returnToOptions(hostname)` in `familyService.ts` shares
`isLocal` with `familySessionCookieOptions`. A hub on `homeofed.com` can never
return anyone to `localhost`.

**5. The return follows a written cookie, and replaces the history entry.** A pick
returns only when `writeFamilySession` stored a cookie; sending a visitor back
without one would send them straight into the gate again. Navigation is
`location.replace`, so the back button from the app does not land on hub's
account page.

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

**7. "Open what was shared" is on the signed-out card only**, rendered when a
fragment came along and `sharedUrl` accepts `returnTo`, and linking to
`<origin>/shared<fragment>`. A refused `returnTo` drops the link along with the
return, and hub behaves exactly as if no `returnTo` had been given; it shows no
warning, because a parent cannot act on one.

## Consequences

- A refused `returnTo` is silent. If the gate ever sends one `safeReturnTo`
  refuses, the visitor lands on `/account` and stays there after the pick, which
  is a stuck visitor rather than an open redirect. `accountUrlFor` already refuses
  to build such a link, so only the gate's own URL could.
- On a local hub, production `returnTo` values are accepted as well as localhost
  ones, because `safeReturnTo` adds the local origins rather than swapping. The
  `.iwft` suite relies on that, routing `https://*.homeofed.com` to a stub page.
- The `.iwft` reaches `/account?returnTo=...#...` through `pushState`, not a real
  `302`. That a browser carries the fragment across the gate's redirect is
  browser behaviour this repo has not yet watched happen; it is to be checked in
  the docker stack (`family hub boop`) once estate-gate ticket 18 makes sign-in
  work there, and recorded here.
- For one frame after a pick, the who's-playing card shows the new player before
  the browser leaves.
