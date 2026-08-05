# 24 — Hint sheet

**What to build:** An optional "?" control that opens a single static hint
sheet — one screen, few words, picture-led. No tooltips machinery, no forced
steps, nothing that interrupts play.

**Design:** the hint-sheet content is the one deliverable the handoff
(`docs/reference/boop-design/README.md`) does **not** cover — ship the
mechanism with first-pass content styled on the paper tokens, and flag the
content for design follow-up. On phone this lives in the "⋯" menu as "How
boop works" (menu built in ticket 27).

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] "?" affordance in a quiet corner opens the sheet; easy touch dismiss
- [ ] One static screen, few words, picture-led (placeholder pictures fine)
- [ ] Covers at most: paint the grid, press play, tempo, share
- [ ] Never auto-opens; nothing else in the app depends on it
- [ ] Open/dismiss covered by a whole-frontend test
