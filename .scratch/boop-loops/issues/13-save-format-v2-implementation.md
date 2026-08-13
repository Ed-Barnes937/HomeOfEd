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

**Status:** ready-for-agent

- [ ] A stored pattern round-trips optional `name` (absent → "Clip N") and optional `tint` (0–4; absent → its position in the list)
- [ ] A stored boop round-trips the optional 16-char `placements` string (`.` empty, `1`–`5` a 1-based clip index) and optional `gridClip` (default 0), on `working` and saved rows alike
- [ ] A V1 document (no new fields) decodes unchanged as a one-clip song with no placements
- [ ] Strict decode: >5 patterns, a dangling placement digit, an out-of-range `gridClip`, or an out-of-range/duplicate `tint` invalidates the boop, and one invalid boop discards the whole document
- [ ] An old `#g=` share link decodes as a one-clip song; a song encodes into a link and round-trips
- [ ] All behaviour covered by `*.test` unit tests (TDD)
