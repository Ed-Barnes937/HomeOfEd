# 07 - hub home: a "who's playing" chip that links to `/account`

**Status:** ready-for-agent
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
