# Share links for songs

Type: grilling
Status: resolved
Blocked by: 01

## Question

A shared boop now carries several clips plus placements and bpm
(ADR 0026: the whole creation lives in `#g=<base64url>`). Decide:

- Is a maximal song (clip ceiling × 96 cells + placements) still a sane URL —
  compute the worst-case length and check it against practical limits
  (messaging apps, QR, browser caps)?
- If not: compress (the grids are sparse booleans), truncate, or is this the
  moment the deferred server-backed short link (ADR 0026's noted fallback,
  fridge's `board.share` pattern) earns its keep?
- Old share links must still decode (via the save format's validator — one
  codec, per ticket 02).

## Answer

**Do nothing — keep plain base64url JSON.** Decided 2026-08-13.

Computed with the real encoder (`encodeShare`) and the launch kit's
instrument ids:

| Payload | Full URL length |
|---|---|
| Today's single-clip boop | ~560 chars |
| Realistic 5-clip song (short names, typical density) | ~2,430 chars |
| Worst case (5 full clips, 24-char names, full placements) | ~2,560 chars |
| Worst case if deflate-compressed first | ~300–420 chars |

Against practical limits, 2.5K passes everywhere that matters: modern
browsers allow far more (the 2,083 figure was Internet Explorer), and
messaging apps carry multi-kilobyte URLs intact. The QR ceiling
(2,953 bytes at version 40-L) is the only nearby limit, and boop has no QR
affordance.

Rejected:

- **Compression** (deflate + `SHARE_FORMAT_VERSION` 2, V1 branch kept) —
  drops links to ~300–420 chars, but buys cosmetics at the cost of a
  permanent second decode branch and an async encode path. It stays the
  planned V2 if a real need appears.
- **Server-backed short link** (fridge's `board.share` pattern) — breaks
  boop's statelessness (ADR 0008) and adds a store to run, moderate and
  expire, for a problem the numbers say we don't have.

Old links are already covered: ADR 0032 has the share codec inherit the save
format's decoder, so a V1 link decodes as a one-clip song with no placements.

**Spec note (agreed):** the spec records the computed worst case as the
justification, plus a one-line revisit trigger — if the clip cap rises past 5
or a QR affordance appears, recompute; compression is the planned V2. No ADR —
spec-level, not architecture.
