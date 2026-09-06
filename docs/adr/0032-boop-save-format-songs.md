# 0032 — boop: the save format grows a song

- **Status:** Accepted
- **Date:** 2026-08-12
- **Related:** [ADR 0025](0025-boop-save-format.md) (the V1 format this
  extends — its decisions stand), [ADR 0026](0026-boop-share-links.md) (the
  share codec, which inherits every choice here), the boop-loops map's
  [Song model limits](../../.scratch/boop-loops/issues/01-song-model-limits.md)
  and [Clip length](../../.scratch/boop-loops/issues/10-clip-length.md)
  decisions. Resolves
  [Save format v2](../../.scratch/boop-loops/issues/02-save-format-v2.md);
  settles the data-model half of
  [Lane reordering](../../.scratch/boop-loops/issues/09-lane-reordering.md).

## Context

The clip-lanes feature turns a boop into a **song**: up to 5 named clips
(ticket 01), each a fixed 6×16 pattern (ticket 10), arranged across 16 song
positions by **placements**, at one bpm. The save document (ADR 0025) must
hold that without breaking a single byte already on disk or in a shared link:
old saves and old `#g=` links must keep round-tripping exactly, and share
links must keep deriving from the save format rather than growing a second
codec.

ADR 0025 anticipated this: `patterns` is an array precisely so "V2 chaining
appends to that array", and `StoredPattern` is an object wrapper precisely to
take per-pattern fields later.

## Decision

1. **Additive fields, no version bump.** `SAVE_FORMAT_VERSION` stays 1. Every
   new field is optional with a default, so a V1 document decodes under the
   same version with no migration branch. Accepted risk: a *stale build* (an
   un-refreshed old tab) reading a new document silently drops the new fields
   and, if it autosaves, clobbers them — transient on a single self-hosted
   app, and no worse than ADR 0025's existing accepted trade-offs.
2. **`patterns` is the clip list.** Each `StoredPattern` gains an optional
   `name` (absent → the automatic "Clip 1", "Clip 2", …). No parallel `clips`
   field, no dual-write. The storage field keeps its frozen name while the
   domain says **Clip** — the same naming mismatch `creations`/boop already
   carries (ticket 35).
3. **Placements are a 16-character string, referencing clips by index.**
   An optional `placements` field on `StoredBoop`: one character per song
   position, `.` for empty, `1`–`5` for a placement of that clip (1-based,
   matching the chip numbering). E.g. `"1112..3311...."`. Index-based rather
   than id-based: with a hard cap of 5 clips there is a single writer and tiny
   arrays, so **reordering clips rewrites the placement string atomically in
   the same state update** — no id generation, uniqueness or dangling-id rules
   in a decode-total codec. Accepted limit: single-digit characters cap any
   future clip ceiling at **9**.
4. **`gridClip` remembers which clip is on the grid.** An optional integer on
   `StoredBoop`, default 0 — present on `working` and saved rows alike, so a
   reload or a load lands on the clip the child was editing.
5. **An old boop decodes to one clip, no placements.** Old saved rows and old
   share links open as a one-clip song with an empty song bar — the decoder
   adds nothing the child didn't make. (An empty song playing the grid clip is
   today's behaviour, so the round-trip is byte-honest.)
6. **Decode stays strict and all-or-nothing.** More than 5 patterns (10, then
   35, since the two 2026-09-06 amendments), a
   placement digit referencing a clip that doesn't exist, or an out-of-range
   `gridClip` makes the boop invalid — and one invalid boop discards the whole
   document, per ADR 0025. These documents have a single writer; violations
   are bugs or corruption, and half-repaired state is more code and more
   states than the risk earns. Corollary: a future cap raise past 5 is a
   breaking read for stale builds — the same accepted stale-tab risk as (1).
7. **No `SHARE_FORMAT_VERSION` bump.** The link scheme
   (`#g=<base64url({ version, creation })>`) is untouched; the share codec
   calls the save format's decoder and inherits everything above, so old
   links decode as one-clip songs automatically.

## Consequences

- Old saves and old links keep working with zero migration code; the only new
  decode paths are the optional-field defaults and the new strictness checks.
- Ticket 09's remaining question is interaction only (the drag, display
  order); the data model is settled here — `patterns` order is lane order,
  and reorder rewrites `placements` in the same update.
- The 16-char placement string caps the clip ceiling at 9 for as long as the
  field exists. Accepted knowingly: the product cap is 5, one tint per clip.
  *(Superseded by the 2026-09-06 amendments: clips are indexed by single
  character rather than single digit, the cap is the alphabet's own ceiling of
  35, and a tint is no longer unique to a clip.)*
- The stale-build clobber risk in (1) and (6) is documented, not mitigated.
  If boop ever stops being a single self-hosted app, revisit before relaxing
  anything else (ADR 0025 already flags the same boundary).

## Amendment (2026-08-13): tints travel with the clip

Resolving [Lane reordering](../../.scratch/boop-loops/issues/09-lane-reordering.md):
a clip's tint is part of its identity, so it must survive reorder and delete —
not re-derive from lane position. `StoredPattern` gains an optional **`tint`**
integer (0–4, an index into the fixed 5-tint list; absent → the pattern's own
position in `patterns`, so old documents decode to today's cycling colours).
New clips and copies take the lowest unused tint, which keeps the
one-tint-per-clip uniqueness of ticket 01 after deletes. Same additive rules
as everything above: no version bump, strict decode (an out-of-range or
duplicate `tint` invalidates the boop). Uniqueness is checked on **effective**
tints — an absent `tint` counts as the pattern's position — so a stated tint
colliding with another pattern's default is also invalid; the single writer
never mixes stated and defaulted tints, so a mix that collides is corruption.
*(The tint's travelling with its clip stands. Everything from "New clips and
copies" on is superseded by the cycling amendment (2026-09-06): a new clip
takes the least-used tint, duplicate tints are legal data, and the defaulted
tint wraps at the palette.)*

## Amendment (2026-08-15): a position holds any number of clips

Decision (3) allowed one clip per position: tapping a lane square in a column
that already held a clip replaced it. Layering is what a child reaches for
next — a drum clip *under* a melody clip, not instead of it — and the lane grid
already draws one square per clip per position, so the affordance was there
and only the model refused. **Every lane square is now its own toggle, and a
position sounds every clip placed in it, together.** There is no cap beyond
the 5-clip cap: a position may hold all five.

- **Storage.** `placements` becomes the 16 positions **comma-separated**, each
  field the 1-based clip indices sounding there, ascending — e.g.
  `"1,12,,3,,,,,,,,,,,,"`. An empty field is an empty position; several digits
  is a layered one. The separator is also the discriminator: a string **with no
  comma** is read in the pre-layering form (16 characters, `.` for empty), so
  every save and share link already on disk still decodes. **The writer emits
  the comma form only once something is actually layered** — a song with at
  most one clip per position is still written the old way, byte-identical. That
  keeps decision (1)'s stale-build risk as small as it can be: here the stale
  build does not merely drop an unknown field, it rejects the boop, and by
  decision (6) one invalid boop discards the *whole* save document. Only a song
  a child has genuinely layered can trip that.
- **Decode stays strict** (6): exactly 16 positions, only clip digits, no
  position naming the same clip twice, and no digit past the clip list. The two
  forms never mix — a `.` inside a comma-separated string is invalid.
- **Playback and export** resolve a position to the clips' patterns **overlaid**
  — a step sounds when any clip in the column has it on — so layering stays
  entirely above the `SequencerEngine` seam (ADR 0024): the engine is still
  handed one pattern per slot. A step two clips share sounds once, not twice.
- **A layered position is still one position.** It occupies one slot in the
  song, counts once in the bars readout, and the grid shows its **topmost lane**
  while it sounds, since the grid can only show one clip.

## Amendment (2026-09-06): ten clips, ten tints, and clips indexed by character

Resolving [Ten clips, ten tints](../../.scratch/boop-clips/issues/04-ten-clips-ten-tints.md)
(the tint-model half of
[Remove the 5-clip cap](../../.scratch/boop-clips/issues/01-remove-clip-cap.md);
persistence direction unchanged - [ADR 0056](0056-boop-clips-stay-local.md)).
Five clips ran out before a child's song did, and the cap was never about
storage: `MAX_CLIPS = TINT_COUNT`, one clip per tint. So the palette grows and
the cap follows it.

- **`TINT_COUNT` and `MAX_CLIPS` become 10.** The handoff's five clip tints are
  untouched; the five new ones are their companions, derived from the handoff's
  own instrument hues and the gaps those leave in the hue circle
  (`features/clips/clipTints.ts` records which is which). `tint` is now 0–9.
  **One tint per clip still holds** in this regime - a new clip takes the lowest
  unused tint, exactly as before - so decision (6)'s duplicate-tint rejection
  and the 2026-08-13 amendment's uniqueness invariant stand as written. (Past
  ten, tints cycle and the invariant lifts; that is
  [ticket 05](../../.scratch/boop-clips/issues/05-thirty-five-clips-cycling-tints.md),
  not this amendment.)
- **A `placements` field indexes clips by single character: digits `1`–`9`,
  then letters from `a` (clip 10)** - in both forms, superseding decision (3)'s
  "single-digit characters cap any future clip ceiling at 9". The digits are
  unchanged, so every string already on disk or in a link is a **strict subset**
  of the new encoding and decodes to the same song. The writer emits a letter
  only when a clip past the ninth is actually placed: a song of nine clips or
  fewer is still written byte-identically to what earlier builds wrote, which
  keeps the stale-build blast radius exactly as small as the layering
  amendment's. The alphabet itself allows 35 clips (`1`–`9`, `a`–`z`); the
  product cap is what stops at 10. *(Superseded by the cycling amendment: the
  cap is the alphabet's ceiling, 35.)*
- **Decode stays total and all-or-nothing** (decision 6). A character past the
  clip list is dangling, and so is one past the cap; the two placement forms
  still never mix. **The stale-build class is the accepted one:** an
  un-refreshed old tab meeting `tint` 5–9, an 11th pattern, or the letter `a`
  rejects that boop, and one invalid boop discards the whole save document
  (ADR 0025) - the same risk decision (1) and the layering amendment accepted,
  and it can only be tripped by a song a child has genuinely grown past five
  clips. Not mitigated, documented: boop is one self-hosted app and a refresh
  is the fix.
- **Nothing else moves.** No version bump, no new field, no
  `SHARE_FORMAT_VERSION` bump (decision 7): the share codec calls the same
  decoder and a ten-clip song travels in a link unchanged. The UI's answer to
  ten lanes is the overflow shape the boxes already had - the clip shelf, the
  lanes and the song-position picker scroll inside their own scrollers (the
  nested scrollers ADR 0030 was amended for), so playback still never scrolls
  for the child.

## Amendment (2026-09-06): thirty-five clips, cycling tints

The second half of the same day's work, resolving
[Thirty-five clips, cycling tints](../../.scratch/boop-clips/issues/05-thirty-five-clips-cycling-tints.md)
and finishing [Remove the 5-clip cap](../../.scratch/boop-clips/issues/01-remove-clip-cap.md).
The amendment above took the cap to ten because a tint had to be a clip's
unique name; that is what the owner lifted. Read the two together: the
encoding is that amendment's, the numbers and the tint rule are these.

- **`MAX_CLIPS` is 35 - the placement alphabet's own ceiling** (`1`–`9`,
  `a`–`z`), *derived* from the alphabet rather than stated beside it, so the
  legal set of clip characters is exactly what this build can write and a
  character past the cap can only ever be dangling. 35 is "no cap" for any
  actual child, and raising it again is not a `MAX_CLIPS` edit but a change of
  encoding: widening a field to two characters would break every string
  already on disk or in a link. `TINT_COUNT` stays 10, so the two constants
  are no longer one decision.
- **One tint per clip is lifted; tints cycle.** A new clip takes the
  **least-used** tint, the lowest of them on a tie - so ten clips still wear
  ten colours (the tie-break makes "least-used" mean "lowest unused" while any
  tint is unused, which is the previous regime exactly), the eleventh starts
  the palette again, and 35 clips spread three to four apiece over the ten. A
  tint is still the clip's **for its whole life**: cycling changes what a clip
  is *given at birth*, and nothing ever recolours a clip that exists. The
  decoder's duplicate-tint rejection is therefore **gone** (superseding the
  2026-08-13 amendment's uniqueness invariant, and the part of decision (6)
  that enforced it): two clips on one tint is data, and every other decode
  rule stands - `tint` is still an integer 0–9 or the boop is invalid.
- **A tint stops naming a clip, so the name does it.** Past ten clips a colour
  is shared, which is only readable because every place a clip shows already
  carries its name: the chip in the shelf (tint dot *plus* name plus ×n), the
  dock launcher ("Edit <name>"), and every lane square's own label
  ("<name>, position 4, on"). The tint's job narrows to "this lane, these
  squares and that dot are one clip" - which is what a child follows while a
  clip is on screen, and needs no uniqueness. Thumbnails were never at risk:
  the ones in "My boops" and the "+ New clip" picker are drawn in ink, not in
  tints.
- **The reader's default for an absent tint wraps at the palette.** ADR 0032's
  default was the clip's own position, which past the tenth position is not a
  tint at all; it is now the position modulo `TINT_COUNT`. Under ten clips that
  is the position, unchanged - and every document the app writes states its
  tints, so only a hand-made or corrupt document takes the branch. Without the
  wrap such a document would decode to a tint the palette has no colour for and
  then fail to decode once written back.
- **Decode stays total and all-or-nothing** (decision 6), and the **stale-build
  class is the accepted one** again, now for the letters `b`–`z` and for
  duplicate tints. A pre-ticket-04 tab rejects any boop naming a clip past the
  ninth, exactly as it does for `a`; a *ticket-04* tab (ten clips, uniqueness
  still enforced) additionally rejects a boop with two clips on one tint, and
  by ADR 0025 one invalid boop discards the whole save document. Only a song a
  child has genuinely grown past ten clips can trip it. Not mitigated,
  documented: boop is one self-hosted app, a refresh is the fix, and the
  writer keeps the blast radius as small as it can - a song of nine clips or
  fewer is still written byte-identically to what every earlier build wrote.
- **Nothing else moves.** No version bump, no new field, no
  `SHARE_FORMAT_VERSION` bump: a 35-clip song travels in a link through the
  same decoder. The UI needed no new overflow either - the clip shelf, the
  lanes and the song-position picker scroll inside the scrollers they already
  had. One measured consequence at the cap: on a 390x844 phone the song bar's
  own scroller takes almost all of the 35 lanes and the region the last 12px,
  which ADR 0030 allows (the *page* is what may never move); at ten clips
  neither box had anything to scroll.
