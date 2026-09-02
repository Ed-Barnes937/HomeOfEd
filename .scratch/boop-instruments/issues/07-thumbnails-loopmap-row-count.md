# 07 - Thumbnails and the loop map at any row count

**What to build:** Every miniature rendering of a pattern honours the clip's
actual rows instead of assuming six: `PatternThumbnail` (the "+ New clip"
picker cards and the "My boops" rows), and the phone's loop map (which also
carries the playhead). Dot/row size scales down as rows grow so the miniature
keeps its footprint - the surrounding layouts (picker card, boops row, the
loop map's reserved height under the grid) must not grow with row count.

Details left to this ticket: the scaling rule (fixed footprint, rows divide
it), a sensible floor where 15+ rows stay legible as texture even if
individual dots blur, and dot colours following the positional hue cycling
from ticket 06. Sample-clip cards keep rendering their authored six rows.

Spec: §4 (geometry - thumbnails and loop map).

**Blocked by:** 04 (row-count state; can start against hand-built patterns
once 02/03 land if 04 is in flight).

**Status:** done

- [x] `PatternThumbnail` renders 1, 6, and 15+ row patterns inside an unchanged footprint, hues cycling positionally *(footprint delivered; the hue clause deliberately not - see Comments)*
- [x] "My boops" rows and picker cards do not change size with row count
- [x] Phone loop map renders the active clip's row count; its reserved height and playhead behaviour are unchanged
- [x] Pure geometry covered by unit tests (`loopMap.ts` / thumbnail maths); one thin `.iwft` look at a many-row clip

## Comments

**2026-09-02** - done.

**The scaling rule: the footprint is fixed, and the rows divide it.**
`thumbnailGeometry.ts` (new, pure, unit-tested) owns it:

- The matrix keeps **the six-row height at every breakpoint** - 44px laptop,
  39px tablet, 33px phone, exactly the numbers the handoff's 8/7/6px pitches
  already produced - whatever the row count. Fixed in
  `PatternThumbnail.module.scss`, so the media queries stay the only place a
  breakpoint is named.
- **1..6 rows return `null`: change nothing.** They keep the handoff's own
  pitch and sit centred in the box (`justify-content: center`), so a six-row
  thumbnail is pixel-identical to before and a one-row clip is one crisp row of
  dots rather than a stretched bar. This is why the whole existing suite is
  untouched.
- **7+ rows divide the same box** in percentages, never pixels: a row's pitch
  is `100 / rowCount`% of the footprint and the dot keeps the handoff's 0.55
  share of that pitch. Percentages are what let one rule cover three
  breakpoints.
- **Only the dot's height scales.** Width is fixed (16 steps on a fixed-width
  card), so as rows grow the dots read as ever-finer horizontal dashes - the
  pattern survives as texture, which is the ticket's "even if individual dots
  blur".
- **The floor is a device pixel on the shortest footprint** (the phone's
  33px). Once 0.55 of the pitch would fall under 1px the dot takes a bigger
  share of its pitch instead; it is spent on the gap between rows, never on the
  box, so the footprint still cannot grow. It starts binding at **18 rows** and
  is pinned by a test at that boundary. It carries 2/64px of slack because a
  dot's height is a percentage *of a percentage* and layout truncates to a
  1/64px unit at each step - asking for exactly 1px measured 0.984px in
  Chromium, which the `.iwft` caught.

**The loop map needed no code change, and that is the finding.** The band is a
*step* readout, not a miniature of the grid: `loopMapTicks` aggregates every
row of the clip onto 16 ticks, so it already read any row count, and its
reserved 44px band cannot grow with rows by construction. Locked with two unit
tests (a whole-roster clip whose **only** note is on the twentieth row - nothing
that reads just the launch six can pass - and a one-row clip) plus a band-height
assertion in the `.iwft`. Playhead behaviour, the cap and the bracket are all
untouched.

**Deviation - the thumbnail keeps its flat ink; no hue cycling.** The ticket
asked for "dot colours following the positional hue cycling from ticket 06",
but the design handoff explicitly rejected hues for exactly these two surfaces:
§1's preset-row thumbnail, as amended by boop ticket 36, reads "thumbnail in
§4's flat-ink tone **rather than per-row instrument hues**", and §4's My boops
row specifies `#14262A` for active dots. Both places a thumbnail appears are
paper cards. `PatternThumbnail`'s own header already recorded that the hued
stage variant "went with the preset row". Applying hues would be a live visual
change to two production surfaces, contradicting a recorded handoff decision,
for no row-count reason - the miniature has no positional hue to get wrong.
Ticket 06's cycling in `Grid.tsx`/`PhoneGrid.tsx` is unaffected. If the epic
wants hued thumbnails after all it is a three-line change
(`ROW_COLOR_VARS[rowIndex % 6]` as the active dot's background) and should carry
a handoff amendment.

Picker cards were never at risk of moving: they are fixed-width and only ever
render the authored six-row samples plus Blank, so the fixed footprint is what
holds them. The "My boops" side is the one the `.iwft` measures - a six-row and
a twenty-row boop seeded side by side, asserting equal thumbnail boxes **and**
equal row heights.

Verified: `pnpm lint` (17/17), `pnpm typecheck` (17/17),
`pnpm --filter boop exec vitest run` (436 passed, 32 files),
`pnpm exec playwright test -c playwright-ct.config.ts` in `apps/boop`
(233 passed). The new `.iwft` was confirmed red before the fix (removing the
fixed footprint fails it).
