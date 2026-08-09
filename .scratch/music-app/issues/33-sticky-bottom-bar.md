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

1. ~~**Full-bleed bar, contents aligned to the centred column.**~~ **Reversed by
   the [layout prototype](37-bottom-bar-prototype.md) (Ed, 2026-08-09): the bar
   is *inset to the column*.** Seen on a screen, the inset bar does not read as a
   "floating toolbar" the way this paper argument predicted — it reads as the
   transport, in the place a child already knows it from. Full-bleed was heavier
   chrome than the screen needs.

   So the bar keeps today's treatment exactly — `max-width: var(--column-width)`,
   `margin-inline: auto`, `border-radius: 20px`, `rgba(255,255,255,.075)`, its own
   22px inset — and is simply *pinned* rather than in the flow. It needs no
   full-bleed background, no border-top, and no trick to align its contents to
   `--column-width`; the play circle still lands under the instrument plates
   because the 22px inset is unchanged. Give it a drop shadow so it sits above
   the scrolling grid.
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
5. Bar clears the iOS safe area — now the bar container's own bottom padding,
   `calc(12px + env(safe-area-inset-bottom))` on phone, since the bar is inset
   rather than full-bleed.
6. **The phone tempo block must be allowed to shrink** (found by the prototype).
   With New boop in the bar, "Fast" runs into the button: 7px clear at 390px and
   a **23px overlap at 360px**. The cause is the `<input type="range">` keeping
   its intrinsic width, so the tempo block never shrinks. Fix: `min-width: 0` on
   the slider and on `.tempoTrackRow`, plus the handoff's 11px phone endpoint
   labels at 28/24px widths. That holds a 14px gap at both 390 and 360.

**Implementation shape:** `.stage` becomes a fixed-height flex column
(`height: 100dvh`), with the grid wrapper `flex: 1; min-height: 0; overflow: auto`
and the bars `flex: none`. The transport's own internal geometry (62px play
circle, tempo block, divider, Clear grid) is unchanged.

**Accepted cost** (prototype, Ed): on a tall window and on the phone the fixed
frame leaves a large empty band between the grid and the pinned bar — the grid is
short and, with the presets moving into ticket 36's dialog, there is nothing to
fill it. Not a blocker; don't try to fix it by stretching the grid.

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

**Blocked by:** — (37 resolved, 29 landed)

**Status:** resolved

- [x] Transport pinned to the bottom, **inset to the 1356px column** (today's
      rounded treatment, unchanged internal geometry), clear of the safe area
- [x] Phone: the tempo block shrinks — "Fast" clears New boop at 390px *and*
      360px — *the shrink fix is in; the New boop clearance itself is
      unverifiable until ticket 36 puts that button in the bar (see Answer)*
- [x] Grid well is the only scrolling region; bars never scroll, on desktop and phone
- [x] Phone: drag-paint, the horizontal snap window and the loop map all behave
      exactly as before — ADR 0027's rules re-verified, not assumed
- [x] Loop map still sits under the grid inside the scroll region
- [x] Handoff §1 and §3 amended; ADR 0027 amended (new ADR 0030)
- [x] Whole-frontend tests: transport visible with the grid scrolled; the existing
      phone paint/scroll suite still green at a short viewport

## Answer

**Built and green** — `pnpm --filter boop lint / typecheck / test`, 67 CT tests
passing.

**The shape.** `.stage` is now a `height: 100dvh` flex column of three sections:
chrome (`flex: none`), the scrolling region (`flex: 1; min-height: 0;
overflow-y: auto`), and the transport (`flex: none`). Pinning by flex layout
rather than `position: fixed` means no z-index, no overlap with the grid, and no
scroll padding under the bar. Each section carries the ticket-29 centring
column, so the pinned bars line up with the grid; the transport is unchanged
apart from a drop shadow and now sitting last.

**Two decisions this ticket did not spell out.**

1. **The preset row moved above the transport**, inside the scrolling region.
   The transport has to be the last thing in the frame, so the starters had
   nowhere else to go — and ticket 36 removes them into a dialog anyway. The
   handoff's §1 stack table is reordered to match.
2. **The frame's horizontal padding moved off `.stage` onto the three sections.**
   The phone preset strip bleeds `-12px` into the frame padding; left on
   `.stage` that bleed would have overflowed the new scrolling region and given
   it a sideways scroll of its own.

**Decision 6's acceptance criterion is only half-verifiable today.** The
`min-width: 0` fix is in (on `.tempoSlider` and `.tempoTrackRow`, with the 11px
endpoints at 28/24px), but the collision it fixes is with **ticket 36's New boop
button, which does not exist yet** — at 360px the bar has slack without it, so
no test can tell the fix from its absence. What is asserted instead is that the
transport never overflows its own width at 360px; the "Fast" clearance itself
should be checked when 36 lands.

**Records.** New **[ADR 0030](../../../docs/adr/0030-boop-fixed-frame-one-scroller.md)**
— the fixed frame, the inset-not-full-bleed bar, and why 0027's phone scroll
model is wrapped rather than changed. ADR 0027 carries an amendment note
pointing at it. Design handoff §1 and §3 both amended. `apps/boop/CLAUDE.md`
gained the frame rule.

**Tests.** New `src/stickyBottomBar.iwft.tsx`, at two deliberately *short*
viewports (1440 × 700 and 360 × 640) so the grid genuinely does not fit — on a
tall window the suite would pass against the old layout too. It covers: the
region scrolls and the document does not, both bars fully in the viewport after
scrolling to the bottom, play still working scrolled, ADR 0027's snap/paint/loop
map at 360 × 640, and the loop map being inside the scrolling region.
`wideScreenLayout.iwft.tsx` gained the inset-not-full-bleed assertion.

**The accepted void is real** and looks as ticket 37 described: at 1440 × 1000
there is roughly 200px of empty stage between the starters and the pinned bar.
Left alone, per the ticket.
