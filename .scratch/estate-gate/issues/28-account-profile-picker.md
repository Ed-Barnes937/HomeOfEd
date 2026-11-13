# 28 - /account becomes a "who is playing" picker

Status: done
Blocked by: none
Type: AFK

## Why

A child chooses their own profile on `homeofed.com/account`. Today that screen is a
grown-up settings page with small text buttons. Ed asked (2026-11-13) for a
Netflix-style chooser, with the settings out of the way behind a cog. An account
customisation ticket (chosen avatars) will follow later, so leave room for it but
do not build it.

## What

Signed in, `/account` shows only the picker:

- One large avatar circle per profile (the parent, then each child), with the name
  under it. Big touch targets, works at phone width, light and dark themes.
- No avatar data exists yet. The circle shows the profile's initial. Add a pure
  `profileInitial(name)` to `@hoe/accounts` (first grapheme, upper-cased) so every
  app shows the same letter. Hub may give each profile its own colour from hub's
  palette, derived stably from the profile id.
- The profile playing on this device is visibly marked, and exposed to assistive
  tech (the current `aria-pressed` is fine).
- A settings cog, labelled for grown-ups, leads to everything else that is on the
  page today (child profiles, last saved, account actions). Prefer a real route
  (`/account/settings`) so the later customisation ticket has a home; check hub's
  server serves it. No parental lock on the cog in this ticket.
- Signed out, the page still shows the sign-in card and the "Open what was shared"
  link, as today.

After a profile is picked:

- With a vetted `returnTo`, go back to the app exactly as today (`returnToApp`).
- With no `returnTo`, navigate to hub home (`/`). Same for the parent profile.
- A `returnTo` must survive a trip to settings and back, so a parent who arrives
  from an app, adds a child, then picks, still lands in the app.

Silent renewal, the cookie write, and the read-back check are unchanged.

## Acceptance

- [ ] iwft: signed in, the picker shows a circle per profile and no settings cards
- [ ] iwft: picking with no `returnTo` lands on hub home with the session set
- [ ] iwft: picking with a `returnTo` still returns to the app
- [ ] iwft: cog opens settings; `returnTo` survives settings and back
- [ ] unit: `profileInitial` (empty, whitespace, emoji, lower case)
- [ ] ADR for the picker/settings split and the go-home rule
- [ ] lint, typecheck, hub and accounts tests green
