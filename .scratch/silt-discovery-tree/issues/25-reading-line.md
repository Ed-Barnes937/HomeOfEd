# 25 - The reading line: one place under the ring where words happen

**Status:** done (built on ticket-25-reading-line, 2026-09-05)
**Type:** task
**Absorbs:** 19 (tag chips to the bottom band - same band, explicit stack
order, land together)
**Source:** ticket 20's research (2026-09-04, findings in
`.scratch/silt-discovery-tree/research/20-label-layout.md` - local-only file,
not in agent worktrees; everything needed is restated here). Ed adopted the
recommendation 2026-09-05.
**Spec:** [../spec.md](../spec.md) §6 (amend the ring's label story), §7.
**ADR:** [0052](../../../docs/adr/0052-silt-the-reading-line.md) - the ring
goes icons-only, and the four calls this ticket left open (see Built).

The research's load-bearing finding: always-on per-spoke labels are
geometrically impossible at the ring's own constants (about 10.4 arc units of
label room per spoke at capacity 12, against real label widths up to 16 in the
test suite's model). It was never a tuning problem, so stop tuning it. The
adopted pattern is what PoE/constellation UIs and Neo4j Bloom converge on:
icons-only graph, one detail region for the active node.

## Design

- **Delete per-spoke outcome text on BOTH platforms** (the phone already ships
  icons-only - `.spokeOutcome` is display:none there). Retire `labelPoint`,
  `RING.labelHalfHeight` and their CSS coupling from ticket 10; arrowheads
  stay and become the sole, now-unobstructed direction encoding.
- **Add the reading line**: a fixed-height band directly under the ring that
  renders the ACTIVE spoke as a recipe row built from the existing element
  tiles - "lava + water -> steam · obsidian" as tiles + words, masked names
  through the same refOf seam as ever (the spoiler surface drops from up to 24
  text sites per ring to this one).
- **Active spoke** = hovered or keyboard-focused on desktop, tapped on phone.
  Navigation moves INTO the reading line's tiles: tapping a spoke on the ring
  selects it into the reading line (it no longer navigates), tapping a tile in
  the reading line navigates to that element. A mis-tap stops throwing the
  player to another element.
- **Empty state**: no spoke active shows a quiet hint ("tap a spoke") in the
  band - the band's height never changes, so the ring never jumps.
- **Grouped spokes (ticket 09)**: the reading line shows the member list
  properly (discovered tiles + silhouettes + the x/y chip) - replacing any
  "..." style degradation the merged spoke currently has.
- **Tag chips (absorbed ticket 19)**: the chips leave the ring's 55px magic
  offset and stack in the same bottom band - chips row first (they describe
  the focused ELEMENT), reading line beneath (it describes the active SPOKE).
  Chip content/allowlist/masking unchanged.
- Desktop overlay and phone sheet share the band; coordinate with ticket 21
  (ring sizing + header band) - if both land, the sheet reads: header (name),
  ring, chips, reading line, footer.

## Tests

- panelModel: the reading-line model for a spoke (tiles, words, masked names,
  grouped members with chip); no outcome field left on the spoke render path.
- ringGeometry: labelPoint and its constants gone; arrowhead cases stand.
- iwft desktop: hover a spoke - the recipe row shows; keyboard focus does the
  same; tile click in the band navigates; ring-tile click only selects.
- iwft phone: tap spoke - reading line fills; band height stable when empty
  vs filled; chips stacked above the line.
- Spoiler: a spoke naming a hidden element renders the hidden name in the
  reading line only, masked.

## Built

- `panelModel`: `Spoke.outcome` and `Spoke.tiles` are gone; a spoke carries a
  `ReadingLine` instead - the whole entry as masked refs, `consumed` telling a
  zero-product entry from a stage (which reads as its one element, no arrow),
  and `members` for a merged spoke's alternatives. Grouping now folds on the
  *reagents* the members share, which is the same stack it produced before and
  a directly useful recipe; the `…` is gone with the words it stood in for.
- `ringGeometry`: `labelPoint`, `outcomePoint`, `tileSide`, `RING.outcomeAt`
  and `RING.labelHalfHeight` retired with their tests (ticket 10 and 17's two
  describes). Arrowheads, insets, the tile box and the capacity all stand.
- The panel: a `.band` between the body and the footer holds the chips row then
  the reading line, both fixed height. Ring tiles read a spoke into the band on
  hover, focus or tap; reading-line tiles navigate.
- Decisions this ticket did not make, all recorded in ADR 0052: the enabled
  ring tile, the sticky active spoke, the stage's missing right-hand side, and
  the reading line's polite live region.
- **Deviation worth knowing**: a ring tile is no longer `disabled` for an
  undiscovered element. It used to be because it navigated; it now reads, and a
  masked reading names nothing - leaving it inert would have made a spoke with
  a hidden partner the one spoke that could not be read. The picker's rows are
  still inert.
- The active spoke is sticky: hovering fills the line and moving away leaves it
  filled. Only selecting another element (or forgetting discoveries) empties
  it. A hover that wiped the line as the pointer left would take it away from
  whoever was reading it.
