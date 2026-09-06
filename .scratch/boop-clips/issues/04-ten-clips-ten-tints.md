# 04 - Ten clips, ten unique tints

**What to build:** A kid can build a song of up to **10 clips**, each with its
own tint. The tint palette grows from 5 to 10: the 5 existing handoff colours
stay exactly as they are, and the implementing agent derives 5 new
kid-distinguishable companions (Ed vetoes at review from a screenshot - flag
the PR ready-for-human on the palette). "+ New clip" and copy stay enabled up
to the new cap; the clip shelf, the song bar's lanes, and the song-position
picker scroll rather than clip once clips outgrow the space (same overflow
shape as the instrument picker). Saving, reloading, and share links all
round-trip a 10-clip song.

**Blocked by:** None - can start immediately.

**Status:** ready-for-human (the palette needs Ed's veto)

Decisions this implements (from the 2026-09-06 grilling session - see ticket
01's comment and [ADR 0056](../../../docs/adr/0056-boop-clips-stay-local.md)):

- `TINT_COUNT` and `MAX_CLIPS` go to 10; one-tint-per-clip uniqueness **holds**
  in this regime (cycling arrives in ticket 05).
- The placements string indexes clips by single character: digits `1`-`9`,
  then the letter `a` for clip 10. Old strings are a strict subset; the writer
  emits a letter only once a 10th clip exists, keeping the stale-build blast
  radius as small as the layering amendment's.
- Decode stays total and all-or-nothing; a stale build meeting tint 5-9 or the
  letter `a` rejects the boop and discards the document - the accepted
  stale-build class from ADR 0032. Say so in the ADR amendment.
- Amend ADR 0032 (do not write a new ADR) and update CONTEXT.md's **Tint** and
  **Song** entries to the shipped model.

Acceptance criteria:

- [x] A 10-clip song can be built, played, saved, reloaded, and shared; every
      clip keeps a distinct tint for its whole life (reorder/delete never
      recolours).
- [x] Every pre-existing save and share link still decodes byte-honestly; a
      ≤9-clip, digit-only song is written byte-identically to today.
- [x] The 11th clip is refused (button disabled, `addClip` no-op) - the cap is
      10 until ticket 05.
- [x] Clip shelf, lanes, and song-position picker are fully reachable at 10
      clips on phone and laptop; playback never scrolls for the child.
- [x] ADR 0032 amended; CONTEXT.md Tint/Song updated; the 5 new tints
      presented for Ed's veto.

## Comments

- 2026-09-06 (implemented, awaiting the palette veto): `TINT_COUNT` and
  `MAX_CLIPS` are 10, one tint per clip still holds, and `placements` indexes
  clips by single character.

  **The five new tints, for veto** (the handoff's five are untouched at 0-4):

  | tint | hex | reads as | where it came from |
  | --- | --- | --- | --- |
  | 5 | `#dce85c` | yellow | the handoff's own hi-hat hue (`tokens.scss`) |
  | 6 | `#6f9cff` | blue | new - the gap between cyan (187°) and violet (263°) |
  | 7 | `#ff6b5c` | coral | the handoff's own kick hue (`tokens.scss`) |
  | 8 | `#8ee06f` | leaf green | new - the gap between yellow (65°) and mint (150°) |
  | 9 | `#f06fe0` | magenta | new - the gap between violet (263°) and pink (337°) |

  Judgement calls:
  - **Two of the five are lifted, not invented.** The clip palette had never
    taken the handoff's kick and hi-hat hues, so half the growth is colour Ed
    already signed off, at the brightness the five were drawn at.
  - **Order is a decision.** A new clip takes the lowest unused tint, so the
    order is the sequence a child meets; it is arranged so each new tint is far
    in hue from the one before it (the smallest such step is 88°).
  - **Where the squeeze landed, and so what to veto.** The handoff's own five
    already sit as close as 37° apart in hue (cyan/mint), and ten tints on one
    dark stage have to go closer: the tightest pairs are orange/yellow 29°,
    pink/coral 29°, orange/coral 30°, pink/magenta 30°, cyan/blue 34° and
    yellow/leaf green 39°. All ten stay inside the handoff's own lightness band
    (61-77% L), so hue is what does the telling apart - which is why the four
    warm 29-30° pairs are the ones to judge from the screenshot rather than
    from the arithmetic.
  - **The placement alphabet is `'123456789abc…z'.slice(0, MAX_CLIPS)`** - one
    constant, so ticket 05 is a `MAX_CLIPS` bump rather than an encoding
    change. The old `[1-5]` regex validation became an alphabet lookup, which
    is what makes a letter past the cap dangling rather than unparseable.
  - **The overflow needed no CSS.** Both lane boxes already scroll (tickets
    23/25): the laptop `.lanes` on both axes, the phone bar's `.lanes`
    vertically under its `max-height: 100%`. So no new nested scroller and no
    new ADR 0030 exception. Where a full song is now exercised: 1280x720
    (chips, "+ New clip", the last ruler numeral and the last lane square all
    reachable, focus rings whole), 1280x900 and 1280x700, 1100x800 and
    1024x800, 1280x600 / 560 / 500 and 1024x500, 1440x700, 390x844 (measured:
    nothing has to scroll at all), 390x380 through 390x520, and 320x640 - the
    one place the lanes really do outgrow the bar, where the bar's own scroller
    takes 50px of them and the region 12, and the page still does not move.
  - **The old "at the five-clip cap" suites now build to `MAX_CLIPS`**
    (`playBarPinned`, `tabletLanes`, `laptopColumnFits`) so they keep testing
    the tightest case rather than a historical one; one POM helper
    (`fillClipsTo`) is the only place that loop now lives.
  - **Which constant a test names is deliberate.** Cap behaviour (add and copy
    disabled) is keyed to `MAX_CLIPS`, one-colour-per-clip to `TINT_COUNT`, and
    the letter `a` to a literal ten - the tenth clip is the first the digits
    cannot name whatever the cap becomes. Ticket 05 should have to touch the
    distinctness assertion and nothing else.
  - Nothing from ticket 05 is here: no cycling, the cap is 10, and letters
    past `a` are rejected as dangling.

  Reviewed with the repo `code-review` skill (Standards + Spec). Acted on:
  the `placements` encoding is now stated in `apps/boop/CLAUDE.md`'s
  persistence rule (a future agent must not widen a field to two characters),
  ADR 0032's superseded decision (3)/(6) text is annotated in place,
  `CLIP_TINTS`' length is tied to `TINT_COUNT` by a test rather than a comment,
  `placementClipIndex('')` no longer reads as clip 1, the phone suite asserts
  the song-position picker too, and the ten-clip tint-lifetime case (delete a
  clip, the rest keep their colours, the next clip takes the freed tint) is
  unit-tested at the cap.
