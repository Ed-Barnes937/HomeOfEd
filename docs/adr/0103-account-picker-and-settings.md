# 0103 - /account is a "who is playing" picker; settings sit behind a cog

- **Status:** Accepted
- **Date:** 2026-11-13
- **Related:** [ADR 0081](0081-hub-account-ui.md) (the `/account` screens, whose
  layout this replaces), [ADR 0095](0095-hub-return-and-renewal.md) (the return
  to the app and silent renewal; decision 1 amended here). Implements estate-gate
  ticket 28 (`.scratch/estate-gate/issues/28-account-profile-picker.md`).

## Context

A child chooses their own profile on `homeofed.com/account`, usually because an
app's gate or "switch player" link sent them there. Until now that screen was a
grown-up settings page: a "Who is playing" card of small text buttons, between
child-profile forms, last-saved lines and the delete-account button. Ed asked
for a Netflix-style chooser, with the settings out of the way. A later ticket
lets profiles choose avatars, so the picker needs a stable look per profile now
and room for a customisation screen later.

## Decision

**1. Signed in, `/account` shows only the picker.** One large circle per profile,
the parent first and then each child in the service's order, with the name under
it. The circle shows `profileInitial(name)` from `@hoe/accounts` (the first
grapheme of the trimmed name, upper-cased), so every app that later draws a
profile shows the same letter. `Intl.Segmenter` is built on first use, and
without it (Firefox < 125, iOS < 14.5) the first code point stands in, so the
package can never stop hub booting.

Each circle's colour is taken by its position in the picker from six hub palette
inks (`PROFILE_COLOURS`, the one list; the page passes the colour as a CSS
custom property). Position, not a hash of the id, so a household of six or fewer
never repeats a colour. The cost is that a child's colour can shift when a
profile before it is deleted; the avatar ticket will replace it with a chosen
look anyway.

The profile playing on this device gets an `outline` ring and a check mark in
`--fg`, which no avatar ink is close to in either theme and which survives
forced-colours mode, and keeps `aria-pressed`. Signed out, the page is as
before: the sign-in card and, with a shared fragment, "Open what was shared".

**2. Everything else moves to `/account/settings`, behind a cog.** Signed in as,
the parent's last saves, the child-profile card and the account actions. The cog
is an icon link labelled "Grown-up settings", with a 44px touch target; there
is no parental lock on it. Signing out or deleting the account there goes back
to `/account` with the same search, so signing in again shows the picker and
any `returnTo` still applies.
`/account/settings` is a real route rather than a toggle, so the avatar ticket has
a home. Hub's server already serves `index.html` for any unknown document path.

It is a child route of `/account`, so `AccountPage` stays mounted between the
two. That keeps the page's silent-renewal state: a sibling route would remount
the page on the way back to the picker and re-evaluate renewal for a frame.
Silent renewal is only attempted on the picker, never on a direct load of
settings.

**3. After a pick, go back to the app, else go home.** `returnToApp` is
unchanged: with a vetted `returnTo` and a cookie that reads back, it replaces
the location with the app. When it returns `false` and the written cookie does
read back (`readsBack`), there is nowhere vetted to return to, so the router
replaces the location with hub home `/`, where the chip shows who is playing.
That covers no `returnTo`, a refused `returnTo`, and the parent's own profile
alike. When the cookie does not read back, the visitor stays on the picker, the
pick is not remembered for silent renewal, and the picker marks whoever the
browser's cookie still names (usually nobody), so a dropped write is never
mistaken for a session.

**4. A `returnTo` survives settings and back.** The cog and the back link carry
the current search, and `stillOnArrival` (ADR 0095 decision 1) now counts
`/account/settings` as the arrival's page. The fragment stays in the in-memory
capture. So a parent who arrives from an app, opens settings, adds a child and
comes back still lands in the app after the pick. `returnTo` is still vetted
only by `safeReturnTo` at the moment of use, and must still equal the one
captured on arrival.

**5. The settings panel no longer prefetches the save summary.** The prefetch
fetched with React Query's `retry: false`, and an observer that subscribed while
it was in flight joined that fetch, so a failed read was never retried. The
parent's own last-saved line requests the summary in the same commit as the
profiles, which is what the prefetch was for.

## Consequences

- A child sees big circles and their name, and nothing else to press except the
  small cog and theme toggle.
- A visitor who arrives on `/account` with nothing to return to now leaves for
  hub home after a pick, instead of staying on the account page. The pick is
  still visible there, in the chip.
- A refresh on `/account/settings` loses the arrival's fragment, because the
  router does not carry it in the address bar. The `returnTo` itself survives.

## Amendment 2026-11-13: a switch from an app lands on hub home

An app's avatar circle (and silt's empty "Choose who is playing" circle) links
to the bare account page: `switchPlayerUrlFor` now carries no `returnTo`, so a
child who switches player from an app ends on hub home, not in the app the
previous child had open. A gate arrival is unchanged: the gate's redirect still
carries `returnTo`, so a signed-out visitor returns to the app after the pick
(decision 3). This replaces the "come back" link of ADR 0080's amended decision
9 and ADR 0094. `accountUrlFor`, which built that link, is gone from
`@hoe/accounts`.
