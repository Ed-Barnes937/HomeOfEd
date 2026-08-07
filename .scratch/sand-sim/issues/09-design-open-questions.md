# 09 — Resolve the design brief's open questions

Type: grilling
Status: resolved
Blocked by: (none)

## Question

The claude-design brief ([design/design-brief.md](../design/design-brief.md),
captured by [08](08-run-claude-design.md)) leaves three decisions the spec
needs locked:

1. **Reset semantics** — does reset clear spawners too, or only the cells
   they have emitted?
2. **Letterboxing conflict** — the brief says the grid "resizes with the
   window, no letterboxing", but [06 — Grid dimensions](06-grid-dimensions.md)
   locked a fixed 300×200 logical grid with scale-to-fit **letterboxed**
   rendering. A fixed-aspect grid cannot fill an arbitrary window without
   letterboxing or distortion — one of the two decisions must bend. Decide
   which wins (and whether 06's decision line needs amending).
3. **Rail collapse** — should the rail collapse to swatches only, for people
   who know the palette? (Likely a post-v1 scope call, but say so explicitly.)

Also confirm the brief's naming rule as a spec constraint: element names are
one word each (Silkscreen at 10px).

## Answer

Resolved in a grilling session, 2026-08-05:

1. **Reset semantics** — reset means reset: it clears **everything**, cells
   *and* spawners (second-click confirm per the brief). A softer "clear cells
   only" affordance is deliberately deferred — add later if user feedback
   asks for it.
2. **Letterboxing** — **ticket 06 wins.** The grid stays a fixed 300×200
   logical grid, scale-to-fit with letterboxing; the brief's "resizes with
   the window, no letterboxing" line is overridden. Soften the visual cost by
   painting the letterbox margins in the `world` colour (`#181510`) so the
   void blends with the grid edge. Grid size was re-examined against
   Sandspiel (which runs 300×300 = 90k cells, ~2–3 physical px per cell) and
   **kept at 300×200** — close enough for v1; 06's decision line stands
   unamended.
3. **Rail collapse** — swatches-only collapse is **post-v1**, stated
   explicitly in the spec. With a four-element v1 roster there is no space
   pressure; collapse is purely additive rail chrome, so nothing in the v1
   layout blocks it later.
4. **Naming rule confirmed** as a spec constraint: element names are one word
   each (Silkscreen at 10px). The water+lava reaction product is named
   **Obsidian** (not "stone/obsidian").
