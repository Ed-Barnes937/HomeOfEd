# 05 — The reveal: entry card and transitions

**What to build:** "Show Definition" reveals the entry in place. Mobile: the word shrinks
56px → 44px, the type row gains a 36px circular audio button, and the entry card expands below —
Definition (eyebrow label + Newsreader body), Example (italic, level-coloured left rule), Synonym
pills, then a full-width outline "Hide Definition". Desktop: the guess card is replaced by the
entry card while the word stays put; the left column gains "Hide definition" beside "Hear it" and
the synonym pills beneath a rule. The transition is a 200ms ease-out fade + 8px rise, suppressed
under reduced motion. "Hide Definition" restores the pre-reveal state, and the reveal resets on
level change.

**Blocked by:** 04 — Word screen pre-reveal.

**Status:** ready-for-agent

Spec: `.scratch/wotd-redesign/spec.md` · measurements in the handoff README §3 and §6; visuals in
`WOTD - Dark Mode.html` (5c/5f and their light pairs). The entry card is Definition + Example +
Synonyms only — no origin section.

- [x] Mobile revealed state matches design frame 5c (light and dark), including the word shrink and circular audio button
- [x] Desktop revealed state matches design frame 5f (light and dark); the word does not move on reveal
- [x] Example rule and synonym pills take the level colour, for all four levels
- [x] Hide returns to the pre-reveal state; reveal state resets when the level changes
- [x] Transition is 200ms ease-out fade + 8px rise and is disabled under `prefers-reduced-motion`
- [x] `.iwft` coverage: reveal shows definition/example/synonyms, hide restores the guess state
- [x] Manual side-by-side against the reference HTML in both themes at 390×720 and 1280×800
