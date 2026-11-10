# 0094 - local saves belong to a profile, and the device's old saves are copied into each

- **Status:** Proposed (built as the spec's defaults; decisions 2 and 3 are open
  calls for Ed in the estate-gate spec)
- **Date:** 2026-11-10
- **Related:** [ADR 0070](0070-family-service.md) (the family service and its
  `slotKey`), [ADR 0080](0080-boop-is-the-first-savestore-client.md) (boop's
  import offer, which decision 3 removes), [ADR 0081](0081-hub-account-ui.md)
  (hub picks the profile), ADR 0093 (the estate gate that makes every session a
  profile). Implements decisions 7-9 of
  [the estate-gate spec](../../.scratch/estate-gate/spec.md).

## Context

Until now an app's `localStorage` document belonged to the device. That was fine
while nobody had to sign in: one tablet, one boop. The estate gate (ADR 0093)
makes every session a family profile, and two children sharing a tablet would
otherwise share, and overwrite, one document while the SaveStore already keeps
them apart per account. The device copy and the server copy would then disagree
about who owns what.

Every device also already holds documents saved before profiles existed, and the
first-slice spec made `slotKey` the `localStorage` key verbatim.

## Decision

**1. The local key is scoped per profile; the SaveStore `slotKey` is not.**
`profileScopedKey(key, accountId)` in `@hoe/accounts` returns `key` for a null
account and `key@<accountId>` otherwise, with the account read from
`readFamilySession()`. The server key already contains the account, so the
`slotKey` stays the unscoped key and no saved row moves. This amends the
first-slice spec's "slotKey = localStorage key verbatim" on the local side only.
Device preferences (themes, sim settings, hints, nudges) stay unscoped, because
they describe the device, not the player.

**2. The device's legacy document is copied, silently, into each profile.**
`adoptLegacyDocument(storage, key, accountId)` copies the unscoped value to the
profile's key the first time that profile opens the app on the device, and does
nothing once the profile has a document of its own. It is a copy, never a move:
the unscoped key is never written again or deleted, so every profile on the
device gets the same starting point and nothing is lost if a profile is later
removed. There is no prompt, because the question "whose are these?" has no
answer a child can give.

**3. boop's import offer and its decline state go away.** With decision 2, a
signed-in profile always syncs, which closes two follow-ups from ADR 0080: how a
parent re-enables sync after declining, and that the offer was the one card a
child met unprompted. Ticket 10 removes it and amends ADR 0080.

## Consequences

- Legacy documents are duplicated once per profile on a device. For small
  documents this is nothing; silt's scenes and thumbnails may meet the
  `localStorage` quota, and ticket 12 measures before adopting.
- **espy's drawing, measured (estate-gate ticket 13, 2026-11-10).** One slot,
  `espy:doodle:v2`, holding the drawing's whole undo history. Chromium's quota
  is 5,242,880 characters per origin. A fresh drawing is 22-31 KB (390x844 to
  1920x1080), a stroke about 120 characters, and every New page adds 21-37 KB,
  because each page's baked ink raster stays in the history across reloads.
  Four copies (the legacy slot and three profiles) fit while the slot is under
  about 1.3 MB, roughly 40 New pages at laptop size. Past that, adoption by a
  later profile fails and is retried, and saves fall back to `session.ts`'s
  stripped copy (one raster, about 45 KB after six pages). Whether to bound the
  slot is an open question for Ed in ticket 13.
- **A full quota during adoption is swallowed, and adoption is retried on the
  next open** (amended 2026-11-10, estate-gate ticket 10, replacing "the error
  propagates so the app decides"). `adoptLegacyDocument` itself still throws.
  `profileStorage` in `@hoe/accounts`, which every app uses, catches the error,
  so a child opening the app never meets a crash.
  - It leaves nothing half-written: a prefix such as silt's scenes is adopted
    all or nothing.
  - The next open simply tries again, because the profile still has no
    document.
  - The cost: if the profile saves its own document before an adoption
    succeeds, it never adopts that key. The legacy document is still on the
    device, unscoped, and nothing is lost.

  Propagating was rejected: the app's only sensible response would be to
  swallow it too.
- "Once" is "while the profile has no document of its own" (for a prefix, no
  key under it). A profile whose documents are removed adopts the legacy ones
  again on its next open; that is accepted, so there is no marker key.
- **The gate is off in production for now, and that opens a window.** Until
  each app's `fly.toml` sets `FAMILY_ACCOUNT_URL`, nothing sends a visitor
  without a family token to hub. A child whose 30-day token has expired
  therefore plays signed out. Their work goes to the unscoped legacy key, and
  they cannot see it under their profile:
  - Adoption only runs while a profile has no document, and theirs already has
    one.
  - It is not lost: it stays on the device, and every new profile on that device
    adopts it.

  This is not changed here. The window is the time between an app shipping
  per-profile saves and its gate turning on, so each app's gate-on PR should
  follow its per-profile PR closely.
- Switching player is a link to hub, never a picker in the app (spec decision
  10). `accountUrlFor(location.href)` builds it, taking hub's address from the
  app's own origin tier (production, dev port, compose port), and is null
  outside the estate, where the app shows no link.
- A session with no profile, which behind the gate means espy's native shell,
  gets the unscoped key from `profileScopedKey` and behaves exactly as before. espy
  does not rely on the shell lacking a cookie: `App.tsx` treats the session as
  `null` whenever `Capacitor.isNativePlatform()`, and the shell runs no
  `reloadOnPlayerChange` and shows no player (amended 2026-11-10, ticket 13).
