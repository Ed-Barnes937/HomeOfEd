# Small-screen lane treatment

Type: prototype
Status: closed
Assignee: ed-barnes937

## Question

The handoff designs only ≥1280px. Design the lane grid, clip header, clip
control, and song bar for tablet (≤1279px) and phone (≤1023px), closing the
gap between breakpoints sensibly. Constraints:

- Phone uses `PhoneGrid` (pinned rail, snap-scrolling step window, loop map) —
  ADR 0027: the grid never shrinks.
- ADR 0030: the stage is a fixed frame; the grid region is the only scroller;
  pinned chrome height is precious. Where does the song bar live on a phone?
- The lane grid already scrolls horizontally on laptop (`overflow-x: auto`) —
  is that enough for tablet, or does geometry shrink first?
- Paint vs scroll on lane squares must follow PhoneGrid's rules
  (`touch-action: pan-x`, tap toggles, drag paints across a boundary).

Output: a rough prototype to react to, then the agreed treatment recorded here.

## Comments

**2026-08-13 — prototype built, awaiting Ed's reaction.** Five variants live on
the real HomePage (dev builds only), switched by the floating pink pill or
`?variant=` at `http://localhost:3008` (`pnpm dev --filter=boop`):

- **a** — phone: song dock **pinned** above the transport (shows the pinned-height cost)
- **b** — phone: song bar **in the scrolling region** (ADR 0030's default home)
- **c** — phone: **vertical song** — positions run down the screen, clips are columns, no sideways scroll
- **d** — tablet 1024–1279: laptop song bar, lanes **scroll** at full 56px squares
- **e** — tablet 1024–1279: laptop song bar, lanes **shrink to fit** the column

In a/b the phone lanes reuse the step window's exact geometry (92px pinned chip
column = the rail, 32px squares, 11px gutters, same 605px strip, snap +
`touch-action: pan-x`), so lane squares align column-for-column under the grid.
Fake song data, stubbed 600ms-per-position playback (the playing ring walks the
lanes), placements toggle for real. Assumption baked in: on phone the clip play
button and speed stay in the pinned transport; a slim clip header (dot, name,
pencil, Copy) sits above the grid well in all phone variants.

Code: `apps/boop/src/features/songproto/` + small mounts in `HomePage.tsx`,
currently uncommitted on the working tree; moves to a `prototype/04-…` branch
at resolution.

## Resolution

**2026-08-13 — Ed chose B (phone) and E (tablet), definitively.** The agreed
treatment, for the spec:

**Phone (≤1023px) — variant B.** The song bar lives **inside the scrolling
region**, below the grid well (ADR 0030's default home; nothing new is pinned).
Its layout:

- Header row: song play circle (cyan, 36px, flips to ink + pause while
  playing), "Your boop", bars count. Clip play and Speed **stay in the pinned
  transport** — the phone keeps its transport bar, unlike the laptop design.
- Lanes reuse the step window's exact geometry so lane squares align
  column-for-column under the grid: 92px pinned chip column (= the instrument
  rail), 32px-wide squares, 5px in-group gaps, 11px group gutters, the same
  605px strip, `scroll-snap-type: x mandatory` to bar lines,
  `touch-action: pan-x`. Paint vs scroll follows PhoneGrid's rules: sideways
  swipe scrolls, tap toggles, a drag paints only after crossing a cell
  boundary (`useDragPaint` with `applyOnPointerDown: false`).
- Chips are compact (tint dot, truncating name, ×n count); "+ New" sits under
  them in the chip column, disabled at the 5-clip cap. The playing ring walks
  the lane squares as the song plays.
- A slim clip header sits above the grid well, in the scroller: "You're
  changing", tint dot, name, pencil, spacer, Copy. (Delete's phone home is a
  spec detail — suggest beside Copy, matching the laptop row.)

**Tablet (1024–1279px) — variant E.** The laptop song bar, pinned as designed,
but the lane grid **shrinks to fit the column** instead of scrolling: squares
turn flexible (`flex: 1`, min-width floor), chips narrow to 128px, ruler
numerals compress with the squares. No sideways scroll anywhere at this width.
At ≥1280px the handoff's laptop geometry applies unchanged.

Prototype (all five variants, the primary source): branch
`prototype/04-small-screen-lanes`, commit a481750 —
`apps/boop/src/features/songproto/` mounted from `HomePage.tsx`.
