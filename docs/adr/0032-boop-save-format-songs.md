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
6. **Decode stays strict and all-or-nothing.** More than 5 patterns, a
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
