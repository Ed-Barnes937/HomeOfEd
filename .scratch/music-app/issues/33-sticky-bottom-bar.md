# 33 — Sticky bottom bar; the grid becomes the only scrolling region

**Reported:** V1 feedback (Ed, 2026-08-07) — the play button looks wrong
left-aligned in the middle of the screen; the transport should be a stickied
bottom bar, and the beat sheet should scroll itself rather than the whole page.

**Starters moving into a "New boop" dialog is split out as ticket 36** — it
touches different files and carries its own onboarding decision (grilled).

**Facts established while grilling:**
- **Nothing in boop is `position: fixed` or `sticky` today** — not the phone
  strip, not the transport.
- **The page does scroll.** `.stage` is `min-height: 100dvh` with no overflow
  control, so a short window scrolls the whole column, transport included. Handoff
  §1's "a single fixed-height column, no page scroll" describes an intent the
  build never enforced.

**Decisions (grilled 2026-08-07):**

1. **Full-bleed bar, contents aligned to the centred column.** The bar spans the
   viewport; its contents align to ticket 29's 1356px column, so the play button
   sits directly under the instrument rail — which is the actual fix for "the
   play button feels left-aligned in the middle of nowhere". A bar inset to the
   column's edges was rejected: it reads as a floating toolbar, not chrome.
2. **Bar contents, left to right:** play, tempo block, divider, then **New boop**
   and **Clear grid right-aligned together**. Both of those throw away what's on
   the grid, so they group — and away from play, since the handoff is emphatic
   that Clear must never be mistakable for "play from the top". Play stays the
   leftmost, biggest, only yellow thing. (The New boop button arrives with ticket
   36; leave the slot for it.)
3. **The phone gets the same treatment**: top strip sticky, transport sticky at
   the bottom, grid scrolling between them. The phone is the screen most likely to
   need scrolling and a play button that scrolls away is the same complaint,
   worse. Phone bar contents: play + tempo + a compact 44px New boop button
   (ticket 36); Clear stays in the `⋯` menu.
4. **The loop map stays inside the scrolling region, glued under the grid.** It
   must not migrate into the sticky bar, or ADR 0027's "the playhead moves from
   the grid to the map" stops being a local relationship and the map becomes a
   second, competing transport.
5. Bar clears the iOS safe area (`env(safe-area-inset-bottom)`).

**Implementation shape:** `.stage` becomes a fixed-height flex column
(`height: 100dvh`), with the grid wrapper `flex: 1; min-height: 0; overflow: auto`
and the bars `flex: none`. The transport's own internal geometry (62px play
circle, tempo block, divider, Clear grid) is unchanged.

**The risk to manage.** The phone grid already owns a horizontal snap-scrolling
step window (ADR 0027: `touch-action: pan-x`, tap toggles, drag paints after a
cell boundary, playback never scrolls the window). Wrapping it in a
vertically-scrolling container can break any of those. Re-verify them against the
ADR, don't assume.

**Design:** handoff §1's four-region stack and "no page scroll" line, and §3's
phone stack, both need amending. **ADR:** this changes the screen architecture and
touches the scroll model recorded in ADR 0027 — amend 0027 or supersede that part
of it with a new ADR (grilled: this is the one part of the V1.1 work that warrants
an ADR, because it is the only one whose original decision lives in an ADR rather
than in the handoff or the spec).

**Blocked by:** 37 — layout prototype (settles the shape); 29 — centred column

**Status:** ready-for-agent (after 37)

- [ ] Transport pinned to the bottom, full-bleed, contents on the 1356px column,
      clear of the safe area, internal geometry per the handoff
- [ ] Grid well is the only scrolling region; bars never scroll, on desktop and phone
- [ ] Phone: drag-paint, the horizontal snap window and the loop map all behave
      exactly as before — ADR 0027's rules re-verified, not assumed
- [ ] Loop map still sits under the grid inside the scroll region
- [ ] Handoff §1 and §3 amended; ADR 0027 amended or partly superseded
- [ ] Whole-frontend tests: transport visible with the grid scrolled; the existing
      phone paint/scroll suite still green at a short viewport
