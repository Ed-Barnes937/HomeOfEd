# 0041 - boop: a clip owns its rows

- **Status:** Accepted
- **Date:** 2026-09-02
- **Related:** [ADR 0024](0024-boop-sequencer-engine-seam.md) (the
  `SequencerEngine` seam, whose `Pattern` this redefines and whose contract
  gains `audition`), [ADR 0027](0027-boop-small-phone-layout.md) ("6 x 16,
  always", restated below), [ADR 0031](0031-boop-saved-state-visibility.md)
  (what counts as "edited"), [ADR 0025](0025-boop-save-format.md) /
  [ADR 0032](0032-boop-save-format-songs.md) (the save format, unchanged in
  shape) and the boop-instruments spec
  ([`.scratch/boop-instruments/spec.md`](../../.scratch/boop-instruments/spec.md),
  §1, §6, §7). Implements ticket 02 of that effort.
  **ADR 0030 needs no amendment** - see the last section.

## Context

boop shipped with a fixed grid: six instruments, sixteen steps, the six being
the launch kit's whole manifest in manifest order. The roster is growing to
twenty voices, and a twenty-row grid is not a toy a 6-year-old can read. So a
clip shows six rows by default and the child changes which six (and how many),
rather than the app showing everything it can play.

That turns "the grid" from a shape into a choice, and the choice has to live
somewhere. The engine's `Pattern` was defined as "one row per kit instrument,
in kit order" - a definition that makes the row list a function of the kit, so
there is nowhere for a per-clip choice to sit.

## Decision

### 1. `Pattern` is the clip's own rows

`Pattern` is redefined: an **ordered list of 1..roster-size rows with unique
`instrumentId`s, each one a kit instrument**. It is no longer derived from the
kit. Two clips of one song may hold entirely different rows; layered
placements sound their union.

Uniqueness is structural, not taste: cells are addressed by `instrumentId`
throughout the engine and the save format, so a clip holding one instrument
twice has no meaning. The floor of one row is what keeps a clip a clip.

`setCell` / `setPattern` / `getPattern` keep their signatures. A row's
*position* no longer indexes the kit, so an instrument's name and artwork are
looked up by the row's id (`features/grid/rowInstruments.ts`).

### 2. `setPattern` is how a row set changes

Adding, removing, reordering or swapping a row is a `setPattern` call, not a
new engine method. The engine mirrors **one clip** and holds no history; the
mutations themselves are song-domain operations on `song/song.ts` (this
effort's ticket 04), which is where the "no duplicates, 1..roster, known ids"
rules are enforced against a *song* rather than against whatever the engine
happens to hold.

Bad input is refused the way the seam already refuses a bad tempo or step, and
**the grid is left untouched**: an empty row list, an instrument named twice,
an instrument the kit does not have, or a row that is not sixteen steps long
each throw, with the new row set discarded before it is adopted.

A fresh grid is the roster's first `DEFAULT_CLIP_ROWS` (six), empty - the
classic kick/snare/hat/tom/marimba/boop, which stay first in the manifest. A
roster smaller than six simply gets all of it, which is what keeps the
three-instrument test kits meaningful.

### 3. `audition(instrumentId)` joins the contract

The picker's whole interaction is browsing by ear, so the seam gains one
method: play that instrument's sample **now**, from a user gesture.

- It sounds whether or not the loop is running, and whether or not the clip has
  a row for that instrument. Audition-on-*toggle* stays engine-internal and
  keeps its opposite rule (silent while playing, because the step will sound
  it): a tap on a cell is an edit, a tap in the picker is a request for a
  sound.
- It touches neither the pattern nor the transport. Applying the swap is the
  caller's separate, undoable-by-retapping edit.
- While the context is `locked` it unlocks first and plays on the way out, so
  nothing is heard synchronously - exactly what audition-on-toggle does.
- An `instrumentId` the kit does not know is **ignored, not thrown**. Every
  other id-taking method on the seam throws, and they should: they mutate
  state. This one is a fire-and-forget side effect wired straight to a child's
  finger, and a stale row must not be able to crash the toy.

### 4. The whole roster is preloaded

`createSequencerEngine` loads every manifest sample up front, regardless of
which rows any clip holds - twenty short one-shots. Loading per row would mean
silence on the first tap of a newly added row and, worse, in the picker, which
auditions instruments no clip has yet. `engine.kit` remains the only
enumeration of instruments.

### 5. Row hues stay positional

`ROW_COLOR_VARS[rowIndex % 6]` is unchanged: rows read top-to-bottom in a
stable rainbow whatever instruments they hold. Deleting a row therefore
recolours the rows below it, which is accepted. A colour field per manifest
instrument is the rejected alternative - revisit if the cycling reads badly
with ten or more rows.

## Consequences

- **The save format does not change shape.** `StoredPattern.rows` is already an
  ordered list of `{ instrumentId, steps }`, and an all-off row still stores
  `steps: "0000000000000000"`, so a clip's instrument *selection* is its
  pattern's row list: it round-trips through the autosave, "My boops" and share
  links with no new field and no version bump. Making the stored rows
  authoritative on decode is ticket 03.
- **Stale builds degrade, they do not reject** (the class of risk ADR 0032
  accepted for layering): an old build reading a boop with a row it has never
  heard of shows the classic six with that row's steps silently absent.
- A row's index no longer says anything about the kit. Any code reading
  `kit.instruments[rowIndex]` is a bug from here on.
- `BeatEvent.hits` is ordered by the pattern's rows, not by the kit. Nothing
  consumed the old ordering as kit order, but it is now a different promise.
- The default row count is a constant on the contract (`DEFAULT_CLIP_ROWS`), so
  clip creation and the engine's own fresh grid cannot drift apart.

## The amendments this makes

### ADR 0024 - the `Pattern` wording, and `audition`

Decision 6's "six rows can land on the same step" is now "as many rows as the
clip holds, across the clips a position layers". The master gain and limiter
staging stands; the number it was tuned against does not, and re-measuring it
is this effort's ticket 08. `ToneAudioDriver` remains the only file importing
`tone`: `audition` needs nothing new from the `AudioDriver` seam, which already
has `play(instrumentId)`.

### ADR 0027 - "6 x 16, always" becomes "16 steps always, and every row"

The rule now reads: **16 steps always; the rows are the clip's own, default
six, minimum one - and no breakpoint may drop a row or a step.** The spirit is
untouched, and it is the whole point of restating it rather than repealing it:
layout never hides music. Playback still never scrolls a row or a column into
view for the child, on either axis.

### ADR 0031 - row mutations are mutations of the song

"Edited" keeps its one app-wide definition, "any mutation of the song", and
gains three members: **row add, row remove, and instrument swap**. They pair
with `afterEdit` like a cell toggle or a lane reorder, so the saved-state ring
and the autosave see them.

### ADR 0030 needs no amendment

The vertical overflow more rows create is absorbed by machinery that ADR is
already the record of: the grid well's nested rows scroller with its pinned
clip-play footer, the phone's scrolling region, the dock cap, and the
three-rows floor (which becomes `min(3, rowCount)` rows plus the loop map - a
narrowing of an existing number, not a new arrangement). No new scroller, so
no new decision.
