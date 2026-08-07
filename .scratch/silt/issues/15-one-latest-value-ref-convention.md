# 15 — Two conventions for pushing latest values into a stable listener

**What's wrong:** The app needs to hand current React values to a long-lived
listener (a keydown handler, a RAF loop) without re-binding it. It does this two
different ways, from two different tickets:

- **Render-phase ref assignment** — tickets 07/09:
  `apps/silt/src/pages/HomePage.tsx:65-70`,
  `apps/silt/src/features/scenes/useScenes.ts:54-55`
  (`const ref = useRef(x); ref.current = x`)
- **One `useEffect` per option** — ticket 04:
  `apps/silt/src/features/sim/useSimLoop.ts:116-146` (eight of them)

Both work today. Having both means the next person picks by coin flip, and the
render-phase form is the riskier one — it mutates during render, which misbehaves
under concurrent rendering and StrictMode double-invocation.

**What to build:** Pick one convention and apply it in all three files. The
`useEffect` form is the safe default; if the eight-effect block in `useSimLoop`
is the objection, one effect syncing all the refs is the middle ground.

**Status:** claimed

- [ ] One convention across `HomePage.tsx`, `useScenes.ts`, `useSimLoop.ts`
- [ ] The choice is written down — a line in `apps/silt/CLAUDE.md` under
      "Rules that are easy to break by accident"
- [ ] No behaviour change; full suite green

**Source:** whole-branch drift review (2026-08-06), Standards axis. Neither
ticket was wrong in isolation — this only exists as a finding when you look at
tickets 04, 07 and 09 together.
