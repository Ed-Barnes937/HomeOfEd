# 10 — Mobile bottom bar and touch painting

**What to build:** The mobile adaptation, per `.scratch/sand-sim/spec.md` §9
and the design brief. Desktop-first stance: this must *work*, nothing more.

- The rail rotates into a bottom bar on small viewports; the palette row
  scrolls sideways and keeps its group order
- Touch targets 44–48px; step drops off; play and reset stay; erase becomes
  the last chip in the palette row
- One finger paints; no pan or zoom in v1

**Blocked by:** 07 — UI shell: rail, header, status bar

**Status:** resolved

- [x] At a phone-sized viewport the bottom bar replaces the rail with the specified contents and target sizes
- [x] Single-finger painting works on a touch device (or emulated touch)
- [x] Desktop layout is unaffected
- [x] `*.iwft` at a mobile viewport covers select + paint + play; lint/typecheck/tests green

## Comments

Resolved across `32cb98f` + `b1decad` (Sonnet agent, worktree branch merged).
CSS-only reflow gated by `(pointer: coarse), (max-width: 700px)` — the same
breakpoint fridge uses per ADR 0023 — so the DOM is identical to desktop and
desktop is untouched. Rail becomes a bottom bar, palette flattens to a
horizontally scrolling row keeping group order, step hidden, erase last,
targets ≥44px. Painting already used pointer events with `touch-action: none`,
so single-finger touch worked already and was verified with a real Playwright
touchscreen tap rather than changed.

**This ticket failed its first gate.** The agent's own code-review sub-agents
never returned, so it committed on self-review alone, having hidden the Brush
and Mode rail sections on mobile — which made **spawner mode (all of ticket 08)
unreachable on a phone** and pinned brush size to the default. A fresh
orchestrator-run review called that blocking, and rightly: spec §9 and design
brief §02 each enumerate the mobile deltas precisely and name only `step` as
dropping, describing the palette as adapting rather than disappearing. Sent
back once; `b1decad` folds brush and mode into the scrolling bottom-bar row at
44px targets and adds two iwft cases proving both are reachable and functional
on a phone.

Accepted judgement calls: hotkey badges (1–9) hidden on mobile chips; the
`pointer: coarse` breakpoint gives touchscreen laptops the compact layout at
any width — inherited ADR 0023 behaviour, not introduced here.

Gate re-run by the orchestrator on the merged 09+10 tree: lint/typecheck clean,
105 vitest + 23 iwft green.

**Whole-branch drift review (2026-08-06) — independently re-reviewed, came back
clean.** This ticket got the heaviest weighting in the drift review precisely
because it had the least scrutiny (its own sub-agents never returned; it
self-reviewed and failed its gate). Both axes examined it fresh and neither found
anything beyond one cosmetic point.

Standards axis: no findings — the mobile path is CSS-only, `HomePage.tsx` has
zero mobile branching, no duplicated markup, no mobile-only state, and the
reachability fix landed as a `display: none` removal rather than a parallel
component. Spec axis: §9's mobile clauses all verified true in code — group order
preserved via `GROUP_ORDER` with only a `flex-direction` flip, ≥44px targets,
erase last, spawner mode reachable and asserted, `step` the only control dropped.

One residual, filed as **ticket 19**: the square icon chips sit at 44×44, the
accessibility floor, where §9's 44–48px would prefer 48.

The review originally flagged this the other way round — that text-padded chips
(`spawner`, `confirm?`) *exceeded* a 48px ceiling. Measuring the rendered boxes
killed that reading: the overflow is width-only and structural (32.8px of padding
and border before any text), and fitting `confirm?` into 48px would need an
illegible font or a glyph instead of the word. §9's "44–48px" is a minimum in the
sense every touch-target guideline means it, not a bound. Ticket 19 records the
measurements and the rejected reading.
