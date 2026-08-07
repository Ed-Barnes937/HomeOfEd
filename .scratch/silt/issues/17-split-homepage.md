# 17 — HomePage accreted five unrelated jobs across four tickets

**What's wrong:** `apps/silt/src/pages/HomePage.tsx` is ~400 lines and changes
for five unrelated reasons — Divergent Change. Tickets 04, 07, 08, 09 and 10 each
added their slice to the same component, and no per-ticket review saw the total.

It currently owns:

1. Tool / mode / brush / element selection state
2. The global keydown map (`:89-136`)
3. The reset-arm timer (see ticket 14)
4. Scene-name display and popover open state
5. The absolutely-positioned world overlay (`:329-380`) — spawner boxes, the
   removal state, the placement ghost, the brush cursor

(5) is the worst of it: it reaches through `controls.gridToCanvasPoint` and
`controls.cellSize()` to do renderer arithmetic in JSX — Feature Envy on the
canvas fit.

**What to build:** Two extractions, both mechanical:

- `<WorldOverlay>` — takes cursor, spawners, mode, brush width and the fit, owns
  all the absolute positioning. The renderer arithmetic moves next to the
  renderer.
- `useSiltHotkeys` — the keydown map, given the actions it dispatches.

Leave the selection state where it is; that genuinely belongs to the page.

**Status:** claimed

- [ ] Overlay markup and its positioning arithmetic live outside `HomePage`
- [ ] The keydown map lives in its own hook
- [ ] No behaviour change — `chrome.iwft.tsx`, `spawners.iwft.tsx` and
      `mobile.iwft.tsx` pass untouched
- [ ] Full suite green

## Sequencing — do this last

**Run this after 13, 14 and 18 have landed.** Not because of a semantic conflict
with any of them, but because this ticket restructures the file all three are
editing. Split the file once, after its contents have settled, rather than making
three tickets rebase onto a reorganised component.

Checked against the actual line ranges (2026-08-07):

| Ticket | Touches in `HomePage.tsx` | Overlaps 17? |
| --- | --- | --- |
| 13 (current scene) | `:38` sceneName, `:56-67` useScenes wiring, header JSX | the Ctrl+S call site inside the hotkey block |
| 14 (armed confirm) | `:19-20`, `:33`, `:39`, `:78-93` | **no** — disjoint lines |
| 18 (first-visit hint) | `:32` hasPainted, `:331` hint JSX | **yes** — the hint sits inside the overlay block |
| 17 (this) | `:69-76` + `:95-143` hotkeys, `:320-388` overlay | — |

An earlier version of this ticket claimed 14 had to go first because "the reset
timer leaves as part of that one". That was wrong: 14 owns the reset timer at
`:19-20`/`:33`/`:39`/`:78-93`, and this ticket touches neither the timer nor
those lines. 14 and 17 are line-disjoint and could run concurrently — a git
conflict in the same file is possible, a semantic one is not.

The real adjacency is **18**, whose first-visit hint (`:331`) sits in the middle
of the JSX block `<WorldOverlay>` would take. Decide whether the hint belongs
inside the overlay component or stays on the page, and say which in the Comments.

**Source:** whole-branch drift review (2026-08-06), Standards axis.

## Comments

**The first-visit hint stays on the page** (2026-08-07, ticket 17).

`<WorldOverlay>` took the brush cursor, the spawner boxes and the placement
ghost — the three things that are *positioned by the canvas fit*. The hint is
not one of them: it is a centred banner pinned to the bottom of the canvas
wrapper, and it never asks the fit where anything is. It also carries state
(`hintVisible`/`hintFading`) whose lifetime is a page concern — the seen flag is
written on first paint and on scene load, both page-owned events. Moving it into
the overlay would mean either moving that state into a presentational component
or threading two values and an `onTransitionEnd` callback through it, in
exchange for nothing. So the overlay is a pure function of cursor, spawners,
mode, brush width and the fit, and the hint stays where ticket 18 put it.

Shape of the split:

- `src/features/render/WorldOverlay.tsx` (+ its own `.module.scss`) — renders a
  fragment, so the elements still position against `.canvasWrap` and DOM order
  is unchanged. `fit` is typed `WorldFit = Pick<UseSimLoopControls,
  'gridToCanvasPoint' | 'cellSize'>` — narrow enough that the overlay cannot
  reach the rest of the loop, without a hand-maintained second copy of the two
  signatures. `hoveredSpawnerIndex` moved in with it — nothing outside the
  overlay used it.
- `src/hooks/useSiltHotkeys.ts` — one window listener, registered once, reading
  the actions off a single latest-value ref synced in a dependency-array-free
  `useEffect` (ticket 15's convention). The brush clamp stayed on the page with
  the brush state; the hook says "-1 / +1".

`HomePage.tsx` 448 → 355 lines. No test file was touched.

**Left for another ticket** (raised by the ticket-17 code review, not fixed here
because both would be behaviour or API changes beyond a mechanical split):

- **Two sources for one number.** `WorldOverlay` sizes the brush cursor and the
  ghost from `cursor.cellSize` but the spawner boxes from `fit.cellSize()`.
  They agree by construction, but `cursor.cellSize` is sampled at pointer-move
  time and `fit.cellSize()` at render time, so they can disagree for a frame
  mid-resize. Collapsing them means dropping `cellSize` from `CursorInfo`,
  which is `useSimLoop`'s API, not this ticket's.
- **A third copy of the SCSS token block.** `WorldOverlay.module.scss` repeats
  `$ink`/`$paper`/`$destructive`, following the house pattern
  (`ScenesPopover.module.scss` already does). Three copies is the point at which
  a shared `_tokens.scss` would earn itself.
