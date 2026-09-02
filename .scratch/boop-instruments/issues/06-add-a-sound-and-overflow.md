# 06 - "+ Add a sound" and the vertical overflow geometry

**What to build:** The row-count chrome and the layout that absorbs it.

- An **"+ Add a sound"** button sits under the last row, **inside the well's
  scrolling rows box** (it scrolls with the rows; the clip play footer stays
  pinned - ADR 0030 as amended by ticket 23). It opens ticket 05's picker in
  **append mode**: choosing adds the row at the bottom and **closes** the
  dialog (a single decision, unlike the browsing swap flow). Disabled when
  the clip holds the whole roster. Present on laptop and phone.
- **Laptop/tablet:** more rows grow the well; the existing nested rows
  scroller absorbs the overflow. No new scroller, no ADR 0030 change.
- **Phone:** the pinned rail and step window gain rows the same way; the
  region scrolls to pay for them. The three-rows-plus-loop-map `min-height`
  floor becomes **`min(3, rowCount)` rows** plus the loop map.
- Playback **never auto-scrolls a row into view** - ADR 0027's rule extended
  to the vertical axis (ticket 02's ADR wording covers this).
- Row hue stays positional, cycling `ROW_COLOR_VARS[rowIndex % 6]`
  (spec §10.2: recolour-on-delete accepted).
- Aria copy becomes dynamic: "N by 16 step grid"; keyboard nav
  (`useGridKeyboardNav`) works over any row count.

Spec: §4 (add flow, colour, geometry), §10.2.

**Blocked by:** 04, 05.

**Status:** done

- [x] "+ Add a sound" appends and closes; disabled at the full roster; reachable on laptop and phone; scrolls with the rows, never pinned over the footer
- [x] 12+ rows: laptop well scrolls its rows with the clip play footer pinned and the grid region behaving per ADR 0030; nothing stretches the grid on a tall window
- [x] 12+ rows on the phone: rail and step window stay aligned, region scrolls, floor is `min(3, rowCount)` rows + loop map; the ≤505px scrolling-page mode still behaves - **with a deviation: there is no floor to narrow** (see the comment below)
- [x] Rows 7+ cycle the six hues; deleting a row recolours rows below (pinned by a test, since it is a decision)
- [x] Playback with the playhead on an off-screen row does not scroll vertically
- [x] Grid aria label reflects the row count; arrow keys traverse all rows

## Comments

**2026-09-02 - Built.**

- **"+ Add a sound" is each renderer's own button** (no shared UI), rendered
  inside `.wellScroll` under the rows in both `Grid` and `PhoneGrid`, so it
  scrolls with the rows while the clip play footer below stays pinned. The
  new props are `onAddRow` + `canAddRow` on `GridViewProps` - the same shape as
  every other grid prop: the view reports the tap, `HomePage` decides.
- **Append mode needed no change to `InstrumentPicker`**, exactly as ticket 05
  predicted. `HomePage`'s `instrumentRow: number | null` became
  `pickerTarget: number | 'add' | null`, so there is still **one** picker on the
  page and one place that decides its title, hue, footer and what a tap does.
  `'add'` tints the dialog in the hue of the row it is about to make
  (`rowColorVar(rows.length)`), auditions, appends, and closes.
- **Deviation, and the significant one: there is no `min(3, rowCount)` floor,
  because there is no floor.** The ticket and ADR 0042 both described narrowing
  the phone well's three-rows-plus-loop-map `min-height`, but screenspace
  ticket 04 had already retired it (and the dock cap) by measurement, and
  `Grid.module.scss`/`PhoneGrid.module.scss` both record that *neither renderer
  has a floor and neither may be given one*: the floor pushed clip play, which
  lives inside that well, wholly below the fold at 390x380 and 667x375. Adding
  a narrowed one back would have re-opened that exact conflict to buy a
  promise the card already keeps. So the acceptance box is met by what replaced
  the floor - the well's own scroll box takes the rows, the page never moves,
  and clip play stays reachable - asserted at 390x844 and at 390x500 (inside
  the retired 505 band) with twelve rows. **ADR 0042's "ADR 0030 needs no
  amendment" section has been corrected**, since it cited both retired props as
  live machinery.
- **`rowColorVar(rowIndex)` is now the one definition of the hue cycle**
  (`instrumentColors.ts`), replacing four copies of
  `ROW_COLOR_VARS[i % ROW_COLOR_VARS.length]` (both renderers, twice in
  `PhoneGrid`, and `HomePage`'s non-null-asserted one). It carries the decision
  and its accepted cost in its doc comment, and `instrumentColors.test.ts`
  pins both: the cycle from row 7 on, and that deleting a row recolours the
  rows below. The DOM half is pinned too, off computed colours
  (`readRowHues`), because the constant being right does not prove the grid
  paints it.
- **Geometry the handoff does not draw** (my calls, recorded in the SCSS): the
  button is left-aligned with the rail and hugs its label rather than filling a
  column, so no breakpoint can crush the text; 44px tall at ≥1280 (the
  handoff's tap-target floor) / 40 at ≤1279 and on the phone; radius from the
  plate it sits under (16 / 12 / 10); the row label's display face a size down
  (15 / 13 / 12px); and a **dashed** 2px border at 22% ink, which reads as an
  empty slot the way the well's empty cells do.
- **This is the one button in the toy that is disabled rather than absent.**
  The house rule is "disable nothing you can simply not show" (and ticket 05
  dropped the remove-row footer on that basis), but the ticket and spec §4 both
  say disabled here, and it is right: the slot is where a child looks, so it
  stays and says why - its label becomes "Add a sound. Every sound is already
  in this clip."
- **Aria copy is dynamic in both renderers** (`${pattern.length} by 16 step
  grid...`). Nothing asserted the literal six: `HomePagePom` already matched
  `/step grid/`.
- Keyboard nav needed no change - `useGridKeyboardNav` has taken `rowCount`
  since it was written, and clamps; a twelve-row walk is now pinned as a test.
  Playback needed no change either: nothing calls `scrollIntoView` on a strike,
  and that absence is now a test rather than a happy accident.

New POM helpers (all in the ticket-06 block): `openAddSoundPicker`, `addSound`,
`verifyAddSoundOffered`/`Disabled`, `verifyAddSoundScrollsWithTheRows`,
`verifyGridRowCountAnnounced`, `readRowHues`, `verifyRailAlignedWithSteps`,
`verifyPlaybackDoesNotScrollVertically`, `verifyWellHugsItsRows`.

Verified: `pnpm lint` and `pnpm typecheck` (17/17 green repo-wide),
`pnpm --filter boop exec vitest run` - **446** green (up 3), and the boop
`.iwft` suite - **252** green (up 10, the new `addASound.iwft.tsx`; 6 of its 9
verified red before the button existed, the other 3 being regression guards for
behaviour that already held).
