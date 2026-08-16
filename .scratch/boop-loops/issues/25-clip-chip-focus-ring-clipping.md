# 25 — The clip chip's focus ring stops being clipped

**What to build:** Tab to a clip chip in the song bar and the cyan focus ring
is sliced off at the top and the right. Give it room.

`.chip:focus-visible` (`features/songbar/SongBar.module.scss:285`) draws a 2px
outline at a 2px offset, so the ring sits 4px outside the chip. Its ancestor
`.lanes` (line 192) is `overflow-x: auto`, which clips overflow on *every*
side, not just horizontally.

- Give `.lanes` `padding: 4px` with a matching `margin: -4px` so the ring falls
  inside the scroll box without moving anything on screen.
- **Keep the offset ring** — don't swap it for an inset `box-shadow`. The
  active chip already carries an inset cyan ring
  (`&[data-active='true']`, line 282); an inset focus ring would be
  indistinguishable from it.
- The same scroll box holds `.square` (line 369) and `.newClip` (line 401),
  both with offset focus rings. Check them at the strip's edges too.
- Check `PhoneSongBar`'s equivalent scroll container for the same bug.

**Ships with:** ticket 24. Both are small edits to
`features/songbar/SongBar.module.scss`, so they share one branch and one PR
rather than conflicting with each other.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Tabbing through every chip at 1280px+ shows a whole, unclipped ring — including the first and last lane
- [ ] Placement squares and "+ New clip" show whole rings, including at the left and right ends of the strip
- [ ] The phone song bar's focus rings are whole
- [ ] The lane grid's on-screen geometry is unchanged — chips, squares and the ruler still line up column-for-column
