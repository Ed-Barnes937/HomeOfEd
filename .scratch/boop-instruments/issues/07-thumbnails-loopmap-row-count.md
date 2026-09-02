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

**Status:** ready-for-agent

- [ ] `PatternThumbnail` renders 1, 6, and 15+ row patterns inside an unchanged footprint, hues cycling positionally
- [ ] "My boops" rows and picker cards do not change size with row count
- [ ] Phone loop map renders the active clip's row count; its reserved height and playhead behaviour are unchanged
- [ ] Pure geometry covered by unit tests (`loopMap.ts` / thumbnail maths); one thin `.iwft` look at a many-row clip
