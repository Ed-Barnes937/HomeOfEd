# 06 — Yesterday strip

**What to build:** The word page shows a dashed "Yesterday" strip for the current level —
"YESTERDAY" eyebrow, the word in Newsreader, its type in italic — pinned to the bottom on mobile
and spanning the content column beneath the desktop grid. It's fed by a new read-only tRPC
procedure that takes the level and returns yesterday's `{ word, wordType, definition }` for it, or
null. Null hides the strip entirely. The strip is display-only (no navigation), and the procedure
never triggers word generation.

**Blocked by:** 04 — Word screen pre-reveal.

**Status:** resolved

Spec: `.scratch/wotd-redesign/spec.md` · strip measurements in the handoff README §1/§2 (mobile)
and §4 (desktop inline definition). Note the spec's deliberate deviation: the strip lives on the
word page only, not the picker.

- [x] New yesterday-word procedure + handler: level in, yesterday's word/type/definition out, null when absent; no generator seam — it never generates
- [x] Handler unit tests at the Store seam with a fixed clock (present, absent, level-scoped), following the existing handler test patterns
- [x] Strip matches the design's dashed treatment in both themes at both sizes
- [x] Strip renders yesterday's word for the current level; switching level switches the strip
- [x] No yesterday row for that level → the strip is not rendered at all (no placeholder)
- [x] Strip is not interactive — no link, no chevron affordance implying navigation beyond the design's static chevron
- [x] `.iwft` coverage: seeded yesterday row shows the strip; unseeded hides it

## Comments

Implemented in commit `9bee956` (wotd(06)). Status set to ready-for-human: the spec's manual
visual check (side-by-side with `WOTD - Dark Mode.html`, both themes, 390×720 and 1280×800)
remains a human step.
