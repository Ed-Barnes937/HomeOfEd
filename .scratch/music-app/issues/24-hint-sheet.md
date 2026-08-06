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

**Status:** resolved

- [x] "?" affordance in a quiet corner opens the sheet; easy touch dismiss
- [x] One static screen, few words, picture-led (placeholder pictures fine)
- [x] Covers at most: paint the grid, press play, tempo, share
- [x] Never auto-opens; nothing else in the app depends on it
- [x] Open/dismiss covered by a whole-frontend test

## Comments

Resolved 2026-08-06 (agent, Sonnet, worktree branch `t24-hint-sheet`,
commit `5ead857`, merged as `16707d9`). HintSheet component (paper tokens,
ConfirmCard overlay idiom): one static screen, four picture-led hints
(paint / play / tempo / share) with placeholder inline SVGs; dismiss via
close button, backdrop tap, or Escape; never auto-opens (dedicated test).
TopBar "?" wired live. 4 new iwft tests. Content is explicitly first-pass —
the design handoff excludes hint-sheet content — **flagged for design
follow-up**. Commit was delayed by the recurring 1Password signing outage;
committed signed on recovery. Gate re-verified by orchestrator post-merge:
lint/typecheck clean, vitest 150/150, playwright CT 33/33.
