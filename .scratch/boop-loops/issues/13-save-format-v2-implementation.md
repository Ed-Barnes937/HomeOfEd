# 13 — Save format v2: clips, tints, placements, gridClip

**What to build:** The save document can hold a whole song, and every old boop
and old share link keeps working. A saved boop carries up to 5 clips (each with
an optional name and tint), a 16-character placement string, and which clip is
on the grid — while an old save or an old `#g=` link opens as a one-clip song
with an empty song bar, byte-identical to what the child made.

Implement ADR 0032 in the save format, including its tint amendment. Additive
optional fields only, `SAVE_FORMAT_VERSION` stays 1, decode stays strict and
all-or-nothing (one invalid boop discards the document, per ADR 0025). The
share codec inherits the save format's decoder — no `SHARE_FORMAT_VERSION`
bump and no second encoding.

Spec: §2 (model and limits), §10 (persistence), §11 (share links).

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] A stored pattern round-trips optional `name` (absent → "Clip N") and optional `tint` (0–4; absent → its position in the list)
- [x] A stored boop round-trips the optional 16-char `placements` string (`.` empty, `1`–`5` a 1-based clip index) and optional `gridClip` (default 0), on `working` and saved rows alike
- [x] A V1 document (no new fields) decodes unchanged as a one-clip song with no placements
- [x] Strict decode: >5 patterns, a dangling placement digit, an out-of-range `gridClip`, or an out-of-range/duplicate `tint` invalidates the boop, and one invalid boop discards the whole document
- [x] An old `#g=` share link decodes as a one-clip song; a song encodes into a link and round-trips
- [x] All behaviour covered by `*.test` unit tests (TDD)

## Comments

Implemented in `persistence/saveFormat.ts` (codec only — the decoder passes the
new fields through without inventing defaults; "Clip N" / tint-from-position /
gridClip-0 are the reader's job, ticket 14). `shareLink.ts` needed no change —
its tests now pin the song round-trip and the one-clip decode of old links.

Two review notes worth knowing:

- Tint uniqueness is checked on **effective** tints (absent → position), so a
  stated tint colliding with a defaulted one also invalidates the boop.
  Recorded as a clarification in ADR 0032's amendment.
- New exported constants: `TINT_COUNT = 5`, `MAX_CLIPS = TINT_COUNT`
  (one clip per tint), `SONG_POSITIONS = 16` — ticket 14 should consume these
  rather than re-declare.
