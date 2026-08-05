# 24 — Hint sheet

**What to build:** An optional "?" control that opens a single static hint
sheet — one screen, few words, picture-led. No tooltips machinery, no forced
steps, nothing that interrupts play. Final illustration style waits for
design; this ticket ships the mechanism and first-pass content.

**Blocked by:** 13 — First sound: tap-to-toggle grid + play/pause.

**Status:** ready-for-agent

- [ ] "?" affordance in a quiet corner opens the sheet; easy touch dismiss
- [ ] One static screen, few words, picture-led (placeholder pictures fine)
- [ ] Covers at most: paint the grid, press play, tempo, share
- [ ] Never auto-opens; nothing else in the app depends on it
- [ ] Open/dismiss covered by a whole-frontend test
