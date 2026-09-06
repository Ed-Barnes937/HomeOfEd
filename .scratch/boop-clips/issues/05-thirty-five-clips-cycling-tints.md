# 05 - Thirty-five clips, cycling tints

**What to build:** Past 10 clips, tints repeat instead of blocking: the 11th
clip onward takes the **least-used** tint, and the hard cap becomes **35** -
the ceiling of the single-character placement encoding (digits `1`-`9`, then
letters `a`-`z`), settled as "no cap" for any actual child. Two clips sharing
a tint must still be tellable apart everywhere a clip shows: names and
thumbnails carry identity where colour alone no longer can.

**Blocked by:** 04 - Ten clips, ten unique tints.

**Status:** ready-for-human

Decisions this implements (2026-09-06 grilling session; ticket 01's comment):

- `MAX_CLIPS` becomes 35; placement characters extend through `b`-`z`.
- The one-tint-per-clip invariant is **lifted**: the decoder's duplicate-tint
  rejection goes, `addClip` assigns the least-used tint (lowest tint wins a
  tie, keeping ≤10-clip behaviour identical to ticket 04's).
- A clip's tint still belongs to it for life - cycling changes assignment at
  birth, never recolouring later.
- Extend the ADR 0032 amendment (stale-build story for letters and duplicate
  tints) and CONTEXT.md's Tint/Song entries for the cycling regime.

Acceptance criteria:

- [x] An 11th clip is created with the least-used tint; a 35-clip song plays,
      saves, reloads, and shares; the 36th clip is refused.
- [x] Documents with duplicate tints decode (they are now legal); every
      pre-existing save and share link still decodes byte-honestly.
- [x] The song bar, shelf, dock launcher, and thumbnails stay readable with
      repeated tints - verified at phone and laptop widths.
- [x] ADR 0032 amendment and CONTEXT.md cover the cycling regime and the
      35 ceiling.

## Comments

- 2026-09-06 (implemented): `MAX_CLIPS` is 35, one tint per clip is lifted, and
  a new clip takes the least-used tint.

  **How the tint is chosen.** `leastUsedTint` (in `song/song.ts`, beside
  `addClip`) counts how many clips wear each of the ten tints and takes the
  first tint on the minimum - so the lowest wins a tie. That single rule covers
  both regimes: while any tint is unused its count is 0, so "least-used" *is*
  "the lowest unused", and behaviour up to ten clips is identical to ticket
  04's, deletes and all. The eleventh clip starts the palette again; 35 clips
  land four apiece on tints 0-4 and three apiece on 5-9. A clip's tint is still
  its own for life - cycling only decides what a clip is given at birth, and
  nothing recolours a clip that already exists.

  **How two clips on one tint stay tellable apart.** They already were, at
  every place a clip shows: the chip carries a name beside its tint dot (both
  bars), the dock launcher reads "Edit <name>", and every lane square's
  `aria-label` is "<name>, position 4, on". So no UI changed - what changed is
  what the tint *means*: "this lane, these squares and that dot are one clip",
  which is what a child follows while a clip is on screen, and which needs no
  uniqueness. Thumbnails were never at risk: the ones in "My boops" and the
  "+ New clip" picker are drawn in ink, and no tint reaches them. Verified
  through the UI at 1280 (11 clips and 35) and at 390x844 (35), plus 320x640
  for reachability.

  Judgement calls:
  - **`MAX_CLIPS` is derived, not stated.** It is `PLACEMENT_CHARS.length`, so
    the cap *is* the encoding's ceiling rather than a number that happens to
    match it: the legal set of clip characters is exactly what this build can
    write, and a character past the cap can only ever be dangling. It also
    makes the next cap raise impossible-by-construction to do by accident -
    it would mean widening a field, which every string on disk forbids.
  - **One thing the ticket did not ask for: the reader's tint default wraps.**
    An absent `tint` defaulted to the clip's *position* (ADR 0032), which past
    the tenth position is not a tint at all. It is now the position modulo
    `TINT_COUNT`. Under ten clips that is unchanged, and every document the app
    writes states its tints - but without the wrap a hand-made 12-clip document
    would decode to tint 11 and then fail to decode once written back. Recorded
    in the amendment; flagging it because it is a decode change beyond the
    ticket's list.
  - **One assertion was deliberately loosened.** The 390x844 phone test
    asserted `verifyNothingIsScrolled` at the cap; at 35 clips the song bar's
    own scroller takes 925px of the lanes and the region the last 12, so it now
    asserts the rule that actually binds - `verifyPageDoesNotScroll` (ADR 0030:
    the region may scroll, the page may not). Every other cap suite still
    passes its original assertion at 35.
  - **What is tested where.** The tint rule, its tie-break, the 35/36 edge and
    the wrapping default are unit tests; duplicate-tint and 35-clip round-trips
    go through the save format and a share link; the UI tests are the ones only
    the UI can answer - repeated tints read by name, a 35-clip song playing,
    autosaved as `z1..............`, restored by a reload, saved into "My
    boops", shared, and refusing the 36th.
  - **A colour is not the only thing that can now repeat.** Two clips made from
    the same sample clip share a *name* as well ("Slow bass" twice), and past
    ten clips they can share a tint too - the one pair a child could not tell
    apart except by lane order. Not touched here: naming is the child's own
    (rename lets them collide deliberately), and de-duplicating sample labels
    is a picker decision. **Ed's call** whether that is worth a follow-up.

  Reviewed with the repo `code-review` skill (Standards + Spec). Acted on: em
  dashes out of new prose, the two test titles that still named the retired
  "lowest unused tint" rule, the stale 10-clip measurement in the phone
  comment (re-measured at 35), `StoredPattern`'s stale "tint = position"
  docstring, a `clip-name-N` test id so the shelf's names are read by identity
  rather than by position in the chip's markup, and the laptop 35-clip case
  now re-reads the names too.
