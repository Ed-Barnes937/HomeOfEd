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

**Status:** resolved

- [x] One convention across `HomePage.tsx`, `useScenes.ts`, `useSimLoop.ts`
- [x] The choice is written down — a line in `apps/silt/CLAUDE.md` under
      "Rules that are easy to break by accident"
- [x] No behaviour change; full suite green

**Source:** whole-branch drift review (2026-08-06), Standards axis. Neither
ticket was wrong in isolation — this only exists as a finding when you look at
tickets 04, 07 and 09 together.

**Resolved (orchestrator, 2026-08-07) — PR #59, merged at `72fb70e`, CI green.**

Convention chosen: **one `useEffect` (no dependency array) per hook/component,
syncing every latest-value ref it owns** — the middle ground the ticket names,
applied to all three files rather than either extreme. Verified in the merged
tree: no render-phase `ref.current = x` remains in `HomePage.tsx`,
`useScenes.ts` or `useSimLoop.ts`; every write now sits inside an effect.
`useSimLoop`'s eight effects collapsed to one. The rule is written into
`apps/silt/CLAUDE.md` under "Rules that are easy to break by accident".

`storeRef` (lazy init) and `errorsRef` (callback write) were correctly left
alone — they are not the latest-value pattern.

**TDD, honestly reported:** no new test, and no red-before-green claimed. This
is a no-behaviour-change refactor with existing coverage, so the discipline was
a green baseline before, the change, then green after — same 111 vitest + 33
iwft counts, with normal timings ruling out the CT-port hazard. That is the
right answer here; a test invented to be red would have been theatre.

Minor in-scope tidy: an adjacent comment reading "the effects above" was
corrected to "the effect above", since the edit made it inaccurate.
