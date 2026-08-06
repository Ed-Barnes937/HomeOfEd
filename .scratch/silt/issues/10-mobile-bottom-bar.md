# 10 — Mobile bottom bar and touch painting

**What to build:** The mobile adaptation, per `.scratch/sand-sim/spec.md` §9
and the design brief. Desktop-first stance: this must *work*, nothing more.

- The rail rotates into a bottom bar on small viewports; the palette row
  scrolls sideways and keeps its group order
- Touch targets 44–48px; step drops off; play and reset stay; erase becomes
  the last chip in the palette row
- One finger paints; no pan or zoom in v1

**Blocked by:** 07 — UI shell: rail, header, status bar

**Status:** claimed

- [ ] At a phone-sized viewport the bottom bar replaces the rail with the specified contents and target sizes
- [ ] Single-finger painting works on a touch device (or emulated touch)
- [ ] Desktop layout is unaffected
- [ ] `*.iwft` at a mobile viewport covers select + paint + play; lint/typecheck/tests green
