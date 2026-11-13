# 29 - each app shows an avatar circle instead of the "playing as" pill

Status: done
Blocked by: 28
Type: AFK

## Why

Ed asked (2026-11-13): once `/account` has avatar circles, replace the
"playing as <child>" pill in each app's header with an avatar circle in the top
right that takes the player to `/account`.

## What

For every app that shows who is playing (hub home, boop, armoury, espy, fridge,
wotd, boids, karesansui, silt - find each one, some name it differently, for
example fridge `PlayerChip`, karesansui `PlayerLink`, silt `SwitchPlayerLink`):

- Replace the pill with a circle showing `profileInitial(name)` from
  `@hoe/accounts` (added by ticket 28).
- Top right of the app's header or play surface, without covering controls.
- Themed to the app. No shared UI: each app owns its own component and styles.
- It is a link to the account page with a `returnTo` back to the current page,
  the same destination the pill uses today.
- Accessible name says who is playing and that it switches player, since the
  visible name is gone.
- Where the pill carries other state (for example boop's synced chip), keep that
  state visible; only the "playing as" part becomes the circle.
- Share routes and signed-out views keep whatever they show today.

## Acceptance

- [ ] every app above shows the circle and no "playing as" text
- [ ] each app's existing player tests updated; POMs find the circle by role and name
- [ ] the link target is unchanged from the pill's
- [ ] lint, typecheck, each touched app's tests green
