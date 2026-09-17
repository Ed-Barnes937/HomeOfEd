# 05 - Trumpet, bass and piano artwork

**Status:** ready-for-agent (carries a ready-for-human gate: Ed's eye)
**Blocked by:** None - can run any time before 10.

**What to build:** Final SVG artwork for the three new instruments in
`public/kits/launch/artwork/`, drawn in the kit's existing flat style (study
the current set - same stroke/fill conventions, same visual weight; the
handoff says flat 512px style). These are applied as CSS masks, so the SVGs
must work as single-colour silhouettes (the mask takes the instrument hue on
the label tile and `rgba(0,0,0,.62)` on painted cells). The handoff's dashed
placeholders must never ship (grill Q4: agent-drawn, Ed approves by eye).

Acceptance criteria:

- [ ] Three SVGs that read clearly at 40x40 (label tile) and 26x26 (cell
      glyph) as masks, consistent with the existing set side by side.
- [ ] Presented to Ed as a screenshot beside the existing icons for the eye
      check (ticket flips to ready-for-human then).
- [ ] No manifest entry references them yet (activation is ticket 10).

## Comments
