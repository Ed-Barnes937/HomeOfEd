# Save format v2

Type: grilling
Status: resolved
Blocked by: 01

## Question

How does the ADR 0025 save document grow to hold a song (clips + placements +
bpm)? Constraints:

- A single-clip boop must round-trip exactly as today — old saved boops and
  old share links keep working (decode is total; corrupt/future reads as
  empty).
- One encoding: share links derive from the save format, never a second codec.
- Decide: version bump vs additive fields; what an old `creations` row decodes
  to (a one-clip song?); whether the working grid slot becomes a working
  *song*.

Likely ends in an ADR (hard to reverse, real trade-off).

## Answer

Recorded in full in [ADR 0032](../../../docs/adr/0032-boop-save-format-songs.md).
The gist:

- **Additive fields, no version bump** — `SAVE_FORMAT_VERSION` stays 1; every
  new field is optional with a default, exactly the growth ADR 0025
  pre-planned. Accepted risk: a stale old build reading a new document drops
  the new fields and can clobber them on autosave.
- **`patterns` is the clip list** — each `StoredPattern` gains an optional
  `name` (absent → auto "Clip N"). No parallel `clips` field.
- **Placements: a 16-char string on `StoredBoop`** — `.` empty, `1`–`5` a
  1-based clip index per song position (e.g. `"1112..3311...."`). Index-based;
  reordering clips rewrites the string atomically in the same update. Accepted
  limit: single digits cap any future clip ceiling at 9.
- **`gridClip`** — optional integer on `StoredBoop`, default 0, remembering
  which clip is on the grid; on `working` and saved rows alike, so the
  working slot *is* a working song.
- **An old boop decodes to one clip, no placements** — the empty song bar,
  nothing added the child didn't make.
- **Decode stays strict, all-or-nothing** — >5 patterns, a dangling placement
  digit, or an out-of-range `gridClip` invalidates the boop and the boop
  discards the document (ADR 0025's philosophy).
- **No `SHARE_FORMAT_VERSION` bump** — the link scheme is untouched; the
  share codec inherits the new decoder, so old links decode as one-clip songs.

Settles the data-model half of
[Lane reordering](09-lane-reordering.md) (see the comment there).
