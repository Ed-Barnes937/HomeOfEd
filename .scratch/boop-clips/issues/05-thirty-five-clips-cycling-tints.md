# 05 - Thirty-five clips, cycling tints

**What to build:** Past 10 clips, tints repeat instead of blocking: the 11th
clip onward takes the **least-used** tint, and the hard cap becomes **35** -
the ceiling of the single-character placement encoding (digits `1`-`9`, then
letters `a`-`z`), settled as "no cap" for any actual child. Two clips sharing
a tint must still be tellable apart everywhere a clip shows: names and
thumbnails carry identity where colour alone no longer can.

**Blocked by:** 04 - Ten clips, ten unique tints.

**Status:** ready-for-agent

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

- [ ] An 11th clip is created with the least-used tint; a 35-clip song plays,
      saves, reloads, and shares; the 36th clip is refused.
- [ ] Documents with duplicate tints decode (they are now legal); every
      pre-existing save and share link still decodes byte-honestly.
- [ ] The song bar, shelf, dock launcher, and thumbnails stay readable with
      repeated tints - verified at phone and laptop widths.
- [ ] ADR 0032 amendment and CONTEXT.md cover the cycling regime and the
      35 ceiling.

## Comments
