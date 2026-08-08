# 37 — Prototype: the new screen shape

**Type:** prototype (throwaway)

**Why:** the bottom-bar layout is the one piece of V1.1 feedback whose *feel*
can't be settled on paper. Ed's words on the decision: "may change when I see it
— could be worth a quick /prototype first before we lock in." A throwaway is far
cheaper to redo three times than the real layout with its tests and its ADR
amendment.

**The question it answers:** does the new screen shape feel right — specifically
does the play button, sitting under the instrument rail in a full-bleed bottom
bar, read as chrome rather than as a floating toolbar; and does a grid that
scrolls inside a fixed frame feel better than a page that scrolls?

**What to build** (use `/prototype`; hardcoded, no engine, no tests, deleted on
resolve):

- The whole new shape together — the three parts only make sense seen at once:
  1. centred 1356px column (ticket 29),
  2. full-bleed sticky bottom bar, contents on that column, order: play, tempo,
     divider, then New boop + Clear grid right-aligned (ticket 33),
  3. grid as the only scrolling region, bars fixed (ticket 33).
- At **two sizes**: laptop (and a deliberately short window, ~700px tall, so the
  scrolling actually happens) and phone (390 × 844, with the pinned rail and the
  loop map under the grid inside the scroll region).
- Static grid content is fine — this is about geometry and weight, not sound.

**Explicitly out of scope:** real audio, the New boop dialog's contents (ticket
36), tests, accessibility polish, and anything touching `apps/boop/src`.

**Blocked by:** — (but 29's centring is the shape it starts from; if 29 has landed,
copy its wrapper)

**Status:** ready-for-agent

- [ ] Prototype runs and is reviewed by Ed at both sizes
- [ ] The outcome is recorded here as either "shape confirmed" or the specific
      changes, and ticket 33's decisions are updated to match **before** 33 starts
- [ ] Prototype deleted (or left on its own branch, never merged)
