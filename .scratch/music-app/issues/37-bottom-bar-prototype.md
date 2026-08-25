# 37 — Prototype: the new screen shape

**Type:** prototype (throwaway)

**Why:** the bottom-bar layout is the one piece of V1.1 feedback whose *feel*
can't be settled on paper. Ed's words on the decision: "may change when I see it
— could be worth a quick /prototype first before we lock in." A throwaway is far
cheaper to redo three times than the real layout with its tests and its ADR
amendment.

**The question it answers:** does the new screen shape feel right — specifically
does the play button, sitting under the instrument rail in a full-bleed bottom
bar, read as chrome rather than as a floating toolbar; and does a grid that
scrolls inside a fixed frame feel better than a page that scrolls?

**What to build** (use `/prototype`; hardcoded, no engine, no tests, deleted on
resolve):

- The whole new shape together — the three parts only make sense seen at once:
  1. centred 1356px column (ticket 29),
  2. full-bleed sticky bottom bar, contents on that column, order: play, tempo,
     divider, then New boop + Clear grid right-aligned (ticket 33),
  3. grid as the only scrolling region, bars fixed (ticket 33).
- At **two sizes**: laptop (and a deliberately short window, ~700px tall, so the
  scrolling actually happens) and phone (390 × 844, with the pinned rail and the
  loop map under the grid inside the scroll region).
- Static grid content is fine — this is about geometry and weight, not sound.

**Explicitly out of scope:** real audio, the New boop dialog's contents (ticket
36), tests, accessibility polish, and anything touching `apps/boop/src`.

**Blocked by:** — (but 29's centring is the shape it starts from; if 29 has landed,
copy its wrapper)

**Status:** resolved

- [x] Prototype runs and is reviewed by Ed at both sizes
- [x] The outcome is recorded here as either "shape confirmed" or the specific
      changes, and ticket 33's decisions are updated to match **before** 33 starts
- [x] Prototype deleted (or left on its own branch, never merged)

## Answer

**The frame is confirmed; the full-bleed bar is not.** Ed reviewed all three
variants at laptop-short (1440 × 700) and phone (390 × 844) and chose **C**.

**What was built.** One throwaway HTML file, no audio and no engine, geometry
and colours copied out of the real SCSS modules. Three variants on `?variant=`,
three sizes on `?view=`:

- **A** — today: `min-height: 100dvh`, the whole column scrolls.
- **B** — the ticket-33 proposal: fixed frame, grid-only scrolling, **full-bleed**
  bottom bar with its contents on the 1356px column.
- **C** — the alternative 33 rejected on paper: same frame, bar **inset** to the
  column as a rounded floating bar (today's transport, pinned).

**The verdict: C.** Seen on a screen, the inset bar does not read as a
"floating toolbar" the way the paper argument predicted — it reads as the
transport, in the place the transport already is, which is exactly what a child
already knows. Full-bleed (B) is heavier chrome than the screen needs. So:

1. **Ticket 33's decision 1 is reversed** — the bar is inset to the column and
   keeps its current rounded, `rgba(255,255,255,.075)` treatment. Nothing needs
   to align a full-bleed bar's contents to `--column-width`, and the bar keeps
   its own 22px inset, so the play circle still lands under the instrument
   plates.
2. **Everything else in 33 stands**: the fixed-height frame, the grid well as
   the only scrolling region, the bar contents and their order, the phone
   getting the same treatment, the loop map staying under the grid inside the
   scroll region, and the safe-area clearance (now the bar's own bottom
   padding, `calc(12px + env(safe-area-inset-bottom))`).

**Two findings the prototype turned up, both for 33:**

- **The phone bar collides.** With New boop in the bar, "Fast" runs into the
  button — 7px clear at 390px and a 23px *overlap* at 360px. Cause: the tempo
  block will not shrink, because the `<input type="range">` keeps its intrinsic
  width. Fix is `min-width: 0` on the slider and on `.tempoTrackRow`, plus the
  handoff's 11px phone endpoints and 28/24px endpoint widths; that holds a 14px
  gap at both 390 and 360.
- **The frame leaves a void.** On a tall window and on the phone, the grid is
  short and the bar is pinned to the bottom, so a large empty band sits between
  them — with the presets gone to ticket 36 there is nothing to fill it. Ed
  accepted this; it is the cost of the fixed frame and it is not a blocker.

**Prototype:** branch `prototype/screen-shape`, never merged (the files sit
under `.scratch/`, which is gitignored on the working branches). Run it with
`python3 -m http.server 4137` from the repo root, then open
`/.scratch/music-app/prototypes/37-screen-shape/`.
