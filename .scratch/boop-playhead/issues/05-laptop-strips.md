# 05 — Laptop: the song strip, the clip rail and the readout

**What to build:** Frame **1b** of the handoff, ≥1280px. Four pieces:

1. The **song strip** — a row inserted as the first child of `.lanes`, above
   `.ruler`, with a cell per position and the cyan bar marker.
2. The **ruler becomes interactive** — numerals get a hit target and a tap jumps
   to the start of that position.
3. The **clip rail** — a row in the grid well between `.barNumerals` and
   `.body`, 16 ticks on `.steps`' exact geometry.
4. The **readout** — `Position 4 · bar 2 of 4`, in the clip header row before
   "Make a copy".

Plus the two geometry consequences the handoff calls out: the play column's
`padding-top` goes 24px → 46px so the play button still centres against the
lanes, and `.barNumerals`' bottom margin drops 8px → 4px to make room for the
rail row.

**Read the handoff's "Laptop geometry (1b)" and match it exactly.** Every number
is given and every one of them aligns to the existing lane and step grids, so
nothing here needs new column maths — the strip's 16 × 56px on an 8px gap is the
lane row's, and the rail's 4 groups of 4 × 62px with 18px gutters is `.steps`'.
If a number you need is not in the handoff, that is a signal you have diverged
from its geometry.

**No new tokens.** `--cyan`, `--ink`, `--shadow-loop-map-tick` and the Chivo
faces all exist; cell tints come from `clipTints.ts` at 32% alpha. Adding a
token here means something is wrong.

Behaviour comes from ticket 04 — this ticket wires gestures to it. The drag hook
is where "was it playing when the drag began?" is remembered, so release can
resume (spec §4). Look at `useDragPaint` for the house shape of a pointer
gesture, but do not reuse it: it latches on cell identity and this is a
continuous axis.

The existing `.playhead` column is unchanged but for one thing: it no longer
unmounts on stop, rendering at `opacity: 0.45`.

Accessibility per spec §4: both strips are `role="slider"` with bar/step values,
arrows move one unit, Home returns to the song's start.

Spec: §4 (behaviour, keyboard), §1.

**Blocked by:** 04

**Four notes from the build** — each one amended into the spec:

1. *No resume on release.* The drag hook remembers nothing about "was it
   playing when the drag began", because a scrub never stops playback (spec §2)
   — so playback is still running at release exactly when it was running at the
   press, and a resume would be dead code. The handoff's wording comes from the
   mock, whose fake clock does pause. `useScrubDrag`'s header records this and
   the `.iwft` asserts the observable rule (`verifySongPlaying` after a drag).
2. *The play button's centring is a band, not a pixel.* The handoff's 46px is
   in as given, but at that value the button's centre sits ~9px above the
   lanes' own centre (the pre-playhead 24px was ~7px out the same way). The
   `.iwft` therefore asserts the centre falls inside the lane rows' band — a
   real guard, since the old 24px put it above them — and the pixel judgement
   stays the by-eye check.
3. *An empty slot resolves forwards.* The spec's clamp rule was written for the
   trailing empties; a *gap* between placed positions needed its own answer.
   Resolving it backwards (the first attempt) made a left-to-right drag double
   back across the gap and forwards again on the other side, which a child would
   see, so a gap now resolves to the start of the next placed position and only
   the trailing empties clamp. Spec §4's "Clamping" says both cases.
4. *An empty ruler numeral is inert.* The strip is a continuous track and must
   answer for every x, but a numeral means one position, and an empty one means
   nothing — so it is `disabled` rather than clamping somewhere the child did
   not point at. The numerals are also out of the tab order (`tabIndex={-1}`):
   the two sliders are the keyboard route the handoff names, and 16 extra stops
   ahead of the lane grid were not asked for.

**Status:** resolved

- [x] The song strip matches the handoff's geometry: cells sit exactly under
      their ruler numerals and lane squares at ≥1280px
- [x] Placed cells carry their topmost clip's tint at 32%; empty cells are the
      dimmed treatment and are not reachable by a scrub (spec §4)
- [x] The marker is one bar wide at the handoff's offset, opacity 1 playing /
      0.45 stopped, hard-cut on change
- [x] Tapping a ruler numeral jumps to that position's start; the current
      numeral takes the handoff's playing and stopped treatments
- [x] The clip rail sits on `.steps`' geometry, snaps to steps, and moves the
      grid's under-playhead highlight
- [x] The readout reads `Position 4 · bar 2 of 4` and tracks both strips
- [x] Dragging either strip scrubs continuously; release resumes playback only
      if it was playing when the drag began
- [x] The play button still centres against the lanes with the strip row above
      them
- [x] `.playhead` renders at 0.45 opacity while stopped instead of unmounting
- [x] `role="slider"` with `aria-valuenow` / `aria-valuetext` on both; arrows
      move one bar / one step, Home goes to the song's start
- [x] No new design tokens
- [x] Whole-page coverage in an `.iwft` suite; the tablet band (1024–1279px) is
      not broken by the new rows
- [x] Whole-page coverage of the scrub-is-not-an-edit rule specifically — a tap
      or drag on the strip leaves the saved-state chrome unmoved and playback
      running. Handed over from ticket 04, which had no gesture to drive it: it
      is the effort's load-bearing rule and the easiest to regress
- [x] **Human, by eye:** side by side against
      `docs/reference/design_handoff_playhead/boop-playhead-mockup.html` at
      1280px and up — approved 2026-08-19, the 46px play column included
