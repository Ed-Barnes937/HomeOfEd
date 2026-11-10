# 07 - hub home: a "who's playing" chip that links to `/account`

**Status:** resolved
**Type:** task
**Spec:** [../spec.md](../spec.md) decision 10

Nothing on hub's home page points at `/account` today.

- A small chip in the home page header (`apps/hub/src/pages/HomePage.tsx`),
  not an app card: "Playing as {name}" when `readFamilySession()` is live,
  "Sign in" otherwise. Both link to `/account`.
- Decode-only display (`readFamilySession` is never an authorisation check).
- Match `_paperTokens.scss`; hub owns its own styles.
- iwft for both states.

Touches the home page only; do not edit `pages/account/`.

## Comments

- Built. The chip sits top-left beside the theme toggle rather than in a
  header row (hub's home has none): over the right rail it would overlap the
  first card row on any viewport shorter than the gallery (about 760px).
  Absolutely positioned, so the cards do not move. Its width is capped at a
  plain 320px (100% - 120px on phones), so it ends at x=404. Measured: the
  rail is a shrinking flex item and the left column never goes narrower than
  the wordmark, so the divider sits at x=444 from 721 to 984 wide (434 with
  fallback fonts, which is what the iwft harness renders) and 484 at 1024.
  The label ellipsises past the cap.
- Text is `--fg` (inherited), not `--muted`, for 4.5:1 contrast at 13px; a
  vertical-only `::before` gives a 44px touch height like the toggle's.
- A name with nothing visible (blank, whitespace, zero-width) reads "Sign in".
- The session is re-read on `pageshow`, so back from an app after the player
  changed shows the new name.
- It is a TanStack `<Link to="/account">`, so it navigates in-app.
- The iwft arranges "playing" with `testing/familySession.ts` `playAs`, a
  `mintTestToken` cookie written before mount (boop's `seedFamily` precedent).
- ADR 0081's "Nothing links to `/account` yet" consequence is amended in place.
