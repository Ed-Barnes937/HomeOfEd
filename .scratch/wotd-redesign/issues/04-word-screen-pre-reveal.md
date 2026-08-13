# 04 — Word screen redesign: pre-reveal

**What to build:** The word page's designed pre-reveal state at both sizes. Header: back link
("Levels" / "All levels"), the level pill with its number badge pushed right, theme toggle.
Mobile: date line, the word at Newsreader 56px, type (italic) + respelling row, self-start
"Hear it" pill, rule, guess prompt, and the full-width level-coloured "Show Definition" button.
Desktop: two-column grid — word at 92px on the left with "Hear it"; the dashed guess card on the
right with prompt and primary button. The level's colour carries through pill, badge, and button.
"Hear it" speaks the word (existing speech module) and animates the speaker icon while playing;
it stays hidden where speech is unsupported.

**Blocked by:** 01 — Theme foundation; 02 — Word type and respelling.

**Status:** ready-for-agent

Spec: `.scratch/wotd-redesign/spec.md` · measurements in the handoff README §2 and §5; visuals in
`WOTD - Dark Mode.html` (5b/5e and their light pairs).

- [x] Mobile pre-reveal matches design frame 5b (light and dark)
- [x] Desktop pre-reveal matches design frame 5e (light and dark); the grid collapses to one column on tablet widths
- [x] Level colour carries through the level pill, number badge, and primary button for all four levels
- [x] "Hear it" plays the word, shows a playing state on the speaker icon, and is absent when speech is unsupported
- [x] Back link returns to the picker; hit targets ≥44px
- [x] `.iwft` coverage: word/type/respelling render for a seeded word; level colour carry-through; back navigation
- [x] Manual side-by-side against the reference HTML in both themes at 390×720 and 1280×800
