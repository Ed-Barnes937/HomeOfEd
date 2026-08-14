# 03 — Level picker redesign

**What to build:** The level picker matches the design at both sizes. Mobile (≤~720px): top bar
with centred wordmark label and theme toggle, date line, "Pick a level, any level!" headline with
the amber accent rule, and a vertical list of tappable level rows (number badge, name, key-stage
sub-label, chevron). Desktop: full-width top bar with the "W" mark + wordmark, date and toggle on
the right, headline row with the right-aligned intro paragraph, and a 4-column card grid with
"START →". Hover deepens each level's tint.

**Blocked by:** 01 — Theme foundation.

**Status:** resolved

Spec: `.scratch/wotd-redesign/spec.md` · measurements in the handoff README §1 and §4; visuals in
`WOTD - Dark Mode.html` (5a/5d and their light pairs).

- [x] Mobile picker matches design frame 5a (light and dark): layout, type, spacing, 2px borders, level colours
- [x] Desktop picker matches design frame 5d (light and dark), content column max-width 1120px
- [x] The grid collapses to a single column below ~720px
- [x] No yesterday strip and no "Past words" pill anywhere on the picker (both out of scope / moved)
- [x] Level rows/cards navigate to the word page for that level; hit targets ≥44px
- [x] Existing `.iwft` picker coverage still passes (navigation, four levels shown)
- [x] Manual side-by-side against the reference HTML in both themes at 390×720 and 1280×800
