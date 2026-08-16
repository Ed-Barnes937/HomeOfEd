# Spec: boop loops (clip lanes)

Status: **agreed** — the boop-loops map's destination. Ready for `/to-tickets`
and `/implement`.

This document folds the design handoff and every decision on the
[boop-loops map](map.md) into one place. Where it cites a ticket or ADR, that
link holds the full reasoning; this spec is the consumable summary plus the
deltas the decisions added on top of the handoff.

**Sources of truth:**

- **Laptop visuals (≥1280px):**
  [`docs/reference/design_handoff_clip_lanes/README.md`](../../docs/reference/design_handoff_clip_lanes/README.md)
  — the **2a Clip lanes** frame. Every geometry number there is final;
  recreate pixel-close. This spec does not restate those numbers — it records
  the deltas (§3) and everything the handoff left open.
- **Data model:** [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md)
  (save format v2, incl. the tint amendment).
- **Vocabulary:** [`apps/boop/CONTEXT.md`](../../apps/boop/CONTEXT.md) —
  **Clip**, **Song**, **Placement**, **Lane**, **Tint**, **Sample clip** are
  the terms of art; use them verbatim in code and copy.
- **Prototype branches** (reference implementations, not production code):
  `prototype/03-song-mode` (the conductor), `prototype/04-small-screen-lanes`
  (phone/tablet lanes), `prototype/12-new-clip-picker` (picker + roster data).

---

## 1. Overview

The existing 4-bar 6×16 grid stays exactly as it is, but it is now always
editing one **clip**. Clips are arranged into a **song** on a lane grid: each
clip owns a lane, each column is a position in the song, and a filled square
(**placement**) means "play this clip here". Repeats are the same clip placed
twice — no repeat counter. Two play modes: loop the grid clip, or play the
song's placements left to right, looping.

## 2. The model and its limits

- **Clip: fixed at 16 steps / 4 bars**
  ([Clip length](issues/10-clip-length.md)). No variable-length clips, ever
  in this effort. Longer phrases come from back-to-back placements; shorter
  ones from sparse grids.
- **Song: fixed at 16 positions**
  ([Song model limits](issues/01-song-model-limits.md)). No grow-on-demand.
  16 positions × 4 bars ≈ 2 minutes at default speed.
- **Clips: capped at 5**, one per tint — the tint list has exactly 5 colours,
  and a unique tint is how a pre-reader traces a lane square back to its chip.
  At the cap, "+ New clip" stays visible but **disabled** (the same pattern as
  "Delete clip" at one clip). Minimum one clip: "Delete clip" is disabled at
  one remaining.
- **Tints travel with the clip**, not the lane position
  ([Lane reordering](issues/09-lane-reordering.md), ADR 0032 amendment).
  Reorder and delete never recolour a clip. New clips and copies take the
  lowest unused tint.
- **Positions layer.** Every lane square is its own toggle: a column holds as
  many clips as the child puts there (up to all 5), and they sound together —
  their patterns overlaid (ADR 0032, 2026-08-15 amendment). A layered column is
  still one position: one slot, one square in the bars count. Superseded: the
  original "one placement per position", where placing a clip replaced the one
  already in the column.
- **Speed (bpm) is a property of the whole boop**, 60–180, driving both play
  modes. Step duration is `15000 / bpm` ms for a 16th.
- **No lane overflow handling.** The 5-clip cap bounds the laptop song bar at
  ~434px of pinned chrome; on short windows the grid region simply shows less
  and scrolls (ADR 0030 — it is the only scroller).

State shape (per the handoff, with decided limits applied):

```
Song {
  bpm: number                     // 60–180, whole boop
  clips: Clip[]                   // 1–5, ordered; order IS lane order
  activeClipIndex: number         // the clip on the grid
  placements: number[][16]        // the clips sounding at each song position,
                                  // in lane order; empty = an empty position
}
Clip { name: string; tint: 0–4; steps: boolean[6][16] }
```

## 3. Laptop layout (≥1280px) — the handoff, plus deltas

The handoff's 2a frame is normative: top bar (with New boop moved in), clip
header row, grid well with tint ring, clip control inside the well, pinned
song bar (header row with Speed, song play column, lane grid, "+ New clip"
row), old transport bar removed. Recreate its numbers exactly.

Deltas decided on the map:

1. **"+ New clip" opens a picker, not a blank clip directly**
   ([Starters and New boop vs clips](issues/07-starters-and-new-boop.md),
   ["+ New clip" picker prototype](issues/12-new-clip-picker-prototype.md)).
   The one deliberate exception to "no new controls beyond the handoff".
   Details in §6. The handoff's hint text beside the button ("Starts you on
   an empty grid") no longer describes the behaviour — drop or reword it
   (suggest: "Add another layer"); the button geometry is unchanged.
2. **"+ New clip" disables at 5 clips** (greyed, not hidden).
3. **"New boop" is a plain button** — no dialog (most of ticket 36's dialog
   is deleted). See §7.
4. **Chip drag reorders lanes** — see §8.

## 4. Tablet (1024–1279px) — variant E

([Small-screen lane treatment](issues/04-small-screen-lanes.md), prototype
branch `prototype/04-small-screen-lanes`.)

The laptop song bar, pinned as designed, but the lane grid **shrinks to fit
the column** instead of scrolling:

- Squares turn flexible (`flex: 1` with a min-width floor).
- Chips narrow to 128px.
- Ruler numerals compress with the squares.
- No sideways scroll anywhere at this width.

Everything else follows the laptop design.

## 5. Phone (≤1023px) — variant B

(Same ticket and prototype branch. `useIsPhone` picks the layout, as today.)

The song bar lives **inside the scrolling region**, below the grid well —
nothing new is pinned (ADR 0030's default home). The phone keeps its pinned
transport bar, unlike the laptop design: **clip play and Speed stay in the
transport**.

- **Slim clip header** above the grid well, in the scroller: "You're
  changing", tint dot, name, pencil, spacer, Make a copy, Delete clip
  (Delete beside Copy, matching the laptop row).
- **Song bar header row**: song play circle (cyan, 36px, flips to ink + pause
  while playing), "Your boop", bars count.
- **Lanes reuse the step window's exact geometry** so lane squares align
  column-for-column under the grid: 92px pinned chip column (= the instrument
  rail), 32px-wide squares, 5px in-group gaps, 11px group gutters, the same
  605px strip, `scroll-snap-type: x mandatory` to bar lines,
  `touch-action: pan-x`.
- **Paint vs scroll follows PhoneGrid's rules** (ADR 0027): sideways swipe
  scrolls, tap toggles, a drag paints only after crossing a cell boundary
  (`useDragPaint` with `applyOnPointerDown: false`).
- **Chips are compact**: tint dot, truncating name, ×n count. "+ New" sits
  under them in the chip column, disabled at the 5-clip cap.
- The playing ring walks the lane squares as the song plays.
- The grid itself is untouched: 6×16 always (ADR 0027), step window, loop map.

## 6. The "+ New clip" picker and sample clips

([Starters and New boop vs clips](issues/07-starters-and-new-boop.md),
["+ New clip" picker prototype](issues/12-new-clip-picker-prototype.md),
prototype branch `prototype/12-new-clip-picker`.)

**Starters are retired, replaced by sample clips.** Pre-made content is a
layer you add (loop-pedal style), not a thing you load over everything.

- Tapping "+ New clip" opens a **dialog** — the New boop paper-card shell,
  starter-style cards (thumbnail + name) in a grid, **Blank first**, then the
  eight sample clips. The dialog shape is chosen because it works on mobile
  too.
- **No per-card preview.** Picking is how you hear a sample clip: landing one
  starts clip playback (the prototype's resolved behaviour — "the clip
  appears, named, and (if not blank) playing"). Picking Blank stays silent.
- Picking lands the choice as a new clip: named after its plain label (Blank
  gets the automatic "Clip N"), lowest unused tint, put on the grid,
  **not** placed in the song (that is a separate tap). A sample clip's name
  is renameable like any other — it is just ADR 0032's optional `name`.
- A sample clip is **pattern-only** — no tempo; it plays at the boop's bpm.
- **Launch roster — all eight ship** (data authored in the prototype's
  `sampleClipsProto.ts`, to be lifted verbatim; steps 1-based):
  - Slow bass — kick 1·9
  - Bouncy bass — kick 1·4·9·12
  - Tap tap hat — hat eighths
  - Sneaky hat — hat off-beats
  - Boom clap — kick 1·9 + snare 5·13
  - Tumble toms — tom 7·8·15·16
  - Twinkle tune — marimba 1·4·7·11·13 + boop 15
  - Boop boop — boop 5·6·13·14
- Sample clips are pure data, additive forever. They get no identity in the
  saved-state model (ADR 0031 amendment) — adding one is an edit like any
  other clip add.

## 7. New boop, Clear grid, first visit

([Starters and New boop vs clips](issues/07-starters-and-new-boop.md).)

- **"New boop"** (top bar ghost button, per the handoff) is a plain,
  no-dialog reset: working slot becomes a one-blank-clip song at default
  tempo, the loaded boop is dropped, no confirm. Ticket 36's dialog is
  deleted along with the starters it offered.
- **"Clear grid"** (in the clip control) is **clip-scoped**: it clears only
  the clip on the grid. It is an *edit* (marks edited) and no longer drops
  the loaded boop.
- **First visit** seeds the working slot with a one-clip song whose clip is a
  sample clip — it still sounds like something and demos the model. (Lives in
  `useWorkingGrid` beside the restore, as today; the seed data changes from a
  starter to a sample clip.)

## 8. Lane reordering

([Lane reordering](issues/09-lane-reordering.md).)

- **Interaction: whole-chip vertical drag**, with a ~8px movement threshold
  separating drag from tap-to-select (PhoneGrid's tap-vs-drag rule). While
  dragging, the chip lifts (scale + shadow — the grid's active language) and
  the other lanes make way live; drop commits. No grab handle, no up/down
  buttons — no new chrome.
- **Data:** `clips[]` order is lane order. A reorder rewrites the placement
  string **atomically in the same state update** (ADR 0032 — placements are
  index-based, no stable ids). Tints travel with their clips.
- **Keyboard:** Ctrl/Cmd+ArrowUp/Down moves the focused chip's lane. Plain
  arrows keep their navigation meaning.
- Reordering counts as "edited".

## 9. Playback

([Song-mode playback mechanics](issues/03-song-playback-mechanics.md),
prototype branch `prototype/03-song-mode` — the conductor in
`PROTOTYPE-song-mode.ts` is the liftable shape.)

- **Play this clip** (yellow, in the clip control) loops the grid clip's 4
  bars. The grid playhead sweeps as today.
- **Song** (cyan) plays the placements left to right, looping the whole song.
  Empty positions are skipped (song sequence =
  `placements.filter(p => p.length > 0)`). As each position starts, the grid
  switches to that clip and its lane square gets the playing ring. A layered
  position rings on every lane in it, and the grid shows its topmost.
- **Only one mode plays at a time.** Tapping a chip while the song plays
  stops the song (you are now editing, not listening).
- **Play always starts at the beginning** (ticket 22). There is no pause, only
  stop and play-from-the-top — one concept, not two. Starting either play
  therefore *stops* the other before it starts: the takeover costs a small
  audible gap, in exchange for a rule with no exceptions. The engine seam has
  no resume semantics ([ADR 0024](../../docs/adr/0024-boop-sequencer-engine-seam.md),
  as amended).
- **Mechanics — no `SequencerEngine` contract change.** Song mode is a
  ~30-line conductor living entirely above the existing seam: it subscribes
  to `onBeat`, and at step 15 calls `setPattern` with the next position's
  clip — for a layered position, that position's clips overlaid into one
  pattern, so the seam still sees one pattern per slot. `onScheduledStep` reads rows fresh each step and `onBeat` fires
  synchronously inside the step-15 callback, so the swap lands before tick 16
  is scheduled — gapless by construction. Proven deterministically (over
  `FakeAudioDriver`) and by ear (real `ToneAudioDriver`).
- **The sounding clip/position must come from the draw channel**
  (`onDrawBeat`), never by re-reading `getPattern()` at swap time — the swap
  happens at *schedule* time, one lookahead (~0.1–0.15s) before the wrap
  sounds, and a naive UI flashes the next clip early. `songPos()`, tick
  monotonicity, and `usePlayheadMotion` carry over unchanged.
- **Speed** drives both modes; changing it counts as edited.

## 10. Persistence — save format v2

(Full detail and reasoning: [ADR 0032](../../docs/adr/0032-boop-save-format-songs.md).)

- **Additive fields, no version bump** — `SAVE_FORMAT_VERSION` stays 1.
- **`patterns` is the clip list**; each `StoredPattern` gains optional `name`
  (absent → "Clip N") and optional `tint` (0–4; absent → its position).
- **`placements`: the 16 positions, comma-separated** on `StoredBoop` — each
  field the 1-based clip indices sounding there, ascending; empty field = empty
  position, several digits = a layered one (e.g. `"1,12,,3,,,,,,,,,,,,"`). A
  comma-less string is read in the pre-layering form (16 characters, `.` empty),
  so old saves and old links still decode — and a song with nothing layered is
  still *written* that way, byte-identical to what earlier builds wrote.
- **`gridClip`**: optional integer on `StoredBoop`, default 0 — on `working`
  and saved rows alike, so the working slot is a working *song*.
- **An old boop decodes to one clip, no placements** — an empty song bar,
  nothing the child didn't make.
- **Decode stays strict, all-or-nothing** — >5 patterns, a dangling placement
  digit, an out-of-range `gridClip`, or an out-of-range/duplicate `tint`
  invalidates the boop, and one invalid boop discards the document
  (ADR 0025's philosophy).
- **No `SHARE_FORMAT_VERSION` bump** — the share codec inherits the save
  format's decoder; old links decode as one-clip songs.

## 11. Share links

([Share links for songs](issues/05-share-links-for-songs.md).)

**No change — plain base64url JSON stays.** Computed with the real encoder:
today's single-clip boop is ~560 chars of URL; a realistic 5-clip song
~2,430; the absolute worst case (5 full clips, 24-char names, full
placements) ~2,560. That passes every practical limit (the old 2,083 figure
was Internet Explorer; messaging apps carry multi-kilobyte URLs; the only
nearby ceiling is QR's 2,953 bytes, and boop has no QR affordance).

**Revisit trigger:** if the clip cap rises past 5 or a QR affordance appears,
recompute; deflate compression under a `SHARE_FORMAT_VERSION` 2 (V1 branch
kept) is the planned next step, dropping links to ~300–420 chars.

## 12. WAV export

([WAV export scope](issues/06-wav-export-scope.md).)

- **Export renders the whole song** — placements left to right, one pass, no
  loop. Clips are not individually exportable.
- **A song with no placements exports the grid clip's 4 bars** — an empty
  song playing the grid clip is today's behaviour (ADR 0032 decision 5), so
  export stays consistent with it and old boops export exactly as they do
  now. Export is never disabled.

## 13. Saved / edited

([The "edited" definition grows](issues/08-edited-definition.md),
ADR 0031 amendment — landed alongside this spec.)

One app-wide definition: **"edited" is any mutation of the song** — a cell
toggle, a speed change, a placement change, clip add, clip delete, clip
rename, or a lane reorder. All of them drop the saved indicator to
"• edited". All mutations of "My boops" still go through `savedState.ts`'s
transitions.

## 14. Accessibility

(Folded in during charting — no ticket.)

**Match the grid's existing arrow-key model.** Lane squares get labels
("Clip 2, position 5, on") and keyboard placement; plain arrows navigate,
the existing toggle key places/removes; Ctrl/Cmd+ArrowUp/Down reorders the
focused chip's lane (§8). The picker dialog follows the New boop dialog's
existing focus/dismiss behaviour.

## 15. Motion

Per the handoff: the existing cell squash (320ms), edit pop (140ms), row bob
(180ms) and load stagger are unchanged. The playing lane square uses the same
hard-cut timing as the grid playhead — no transition on position.

## 16. Out of scope

- **Dragging a placement sideways** — undesigned; remove and repaint covers
  it. Returns only as a fresh effort.
- Variable-length clips, song lengths past 16 positions, clip caps past 5,
  per-clip export, share-link compression — all recorded above with their
  revisit conditions where relevant.

## 17. Execution notes

- TDD per repo rules: `*.test` for logic (conductor, save format, savedState
  transitions, placement string rewriting), `*.iwft` for whole-page
  behaviour. Test engine behaviour against `FakeAudioDriver`.
- The prototype branches are reference material to lift shapes and data from
  (the conductor, the lane geometry, `sampleClipsProto.ts`) — not code to
  merge.
- Retirements to carry out: the starters (`features/presets/presets.ts`
  content and `NewBoopDialog.tsx`), the old transport bar's laptop layout
  (its pieces move per the handoff), ticket 36's dialog behaviours.
