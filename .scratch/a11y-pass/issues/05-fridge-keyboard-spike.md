# 05 - Spike: keyboard access for fridge magnets

**Status:** ready-for-agent
**Type:** prototype
**Spec:** [../spec.md](../spec.md) §5

Fridge magnets are plain `<div>`s with pointer handlers only
(`apps/fridge/src/features/board/MagnetView.tsx:73-81`): no `tabIndex`, no
`role`, no `aria-label`, no `onKeyDown`. The core verbs - place, drag (with
physics bumping), rotate, remove - are all pointer-only, and the instructions
say so ("drag to bump - click to rotate - double-click to remove",
`TopBar.tsx:60`). For a child who cannot use a mouse the app's entire purpose
is unreachable (WCAG 2.1.1). The toolbar/tray is fine (real buttons).

This is a **spike, not a build**: answer the design question, throw the code
away.

## The question

What should keyboard-driven magnet interaction feel like, and is it buildable
without distorting the pointer experience?

Sub-questions the answer must cover:

1. **Focus model** - how does focus move between ~dozens of magnets on a 2D
   board? Roving tabindex with arrow-key spatial navigation? One tab stop for
   the board with arrows moving a cursor? What do kids' apps and
   drag-and-drop ARIA patterns (e.g. the WAI-ARIA drag alternatives:
   pick-up / move / drop) do here?
2. **The verbs** - a concrete key mapping for pick up, move (in steps?
   which granularity?), drop, rotate, remove. Does keyboard movement drive
   the same `relax()` bump physics (`packages/magnet-kit/src/relax.ts:35-62`
   runs per pointer event today, so per-keypress is plausibly free)?
3. **Placement from the tray** - the tray-to-board flow without a drag.
4. **Announcements** - what a screen reader should say on pick-up/move/drop
   (live region contents), even if full SR support is a later ticket.
5. **Cost & seams** - what the real build would touch (`MagnetView`,
   `FridgeDoor`, `useFridgeBoard` reducer, instructions copy) and roughly how
   big it is.

## Approach

- Read `useFridgeBoard.ts` first - the reducer already models the verbs as
  actions, so the spike is mostly "can a keyboard synthesise the same
  actions", which is promising.
- Prototype the one genuinely uncertain piece (spatial focus + pick-up/move
  with live physics) as a throwaway on a branch; do not polish, do not test,
  do not merge.
- A short desk-review of prior art counts as evidence: ARIA APG's grid /
  drag-drop guidance, and any kids' board-style app with keyboard support.

## Answer format

Append under `## Answer` here: the recommended interaction model (keys +
focus model), what the prototype proved or disproved, screenshots/gif if
useful, the estimated build shape, and a go/no-go recommendation. If go, the
follow-up build ticket gets written then - not as part of this spike.

## Constraints

- Throwaway branch; nothing merges from this ticket.
- No changes to `packages/magnet-kit` even in the prototype if avoidable -
  the point is to test whether the existing seam is enough.

## Answer

**Go.** The reducer already models every verb, `relax()` is effectively free
per keypress, and a working prototype (throwaway commit on this branch) drives
pick-up / move / bump / rotate / cancel / remove from the keyboard with **zero
changes to `packages/magnet-kit` and zero changes to the pointer handlers**.
181 lines of app wiring plus a 111-line pure nav module got the whole loop
working in a real browser. Estimated real build: ~450-550 lines including
tests, one PR.

### Prior art (desk review)

- **There is no ARIA APG drag-and-drop pattern.** `aria-grabbed` and
  `aria-dropeffect` were deprecated in ARIA 1.1 with poor and non-improving AT
  support - do not use them. Nothing replaced them, so the pattern has to be
  assembled from the Grid pattern plus the de-facto library idiom.
- **APG Grid / layout-grid** supplies the focus model: one tab stop for the
  whole container, arrow keys move focus inside it, roving `tabindex`. Note the
  fridge is *not* a grid (no rows/columns, magnets overlap), so `role="grid"`
  would be a lie - borrow the focus mechanics, not the role.
- **The de-facto keyboard-DnD idiom is unanimous** across dnd-kit and
  react-beautiful-dnd: Space **or** Enter to pick up, arrows to move, Space or
  Enter to drop, Escape to cancel, plus author-supplied screen-reader
  instructions and a live region. Both libraries also stress the "third rule of
  ARIA": Enter and Space must both activate. Following the idiom is worth more
  than inventing something more kid-friendly - it is what any AT user already
  expects, and it costs nothing.
- WCAG framing: this closes **2.1.1 Keyboard** (A) and, with a focus ring,
  **2.4.7 Focus Visible** (AA) and **4.1.2 Name, Role, Value** (A) for what are
  currently unlabelled `<div>`s. It does **not** close **2.5.7 Dragging
  Movements** (AA), which specifically demands a *single-pointer* alternative -
  that stays a separate gap and is out of scope here.

### 1. Recommended focus model

- **The board is one tab stop.** Roving `tabindex`: exactly one magnet carries
  `tabIndex=0`, all others `-1`. Tab from the toolbar lands on the last-focused
  magnet (first in reading order on a fresh board); Tab again leaves for the
  tray. Verified in the browser: one tab stop before and after every operation,
  including after a delete.
- **Magnets get a real accessible identity**: `role="button"`,
  `aria-roledescription="fridge magnet"`, `aria-label` (`"blue letter E"`,
  `"yellow disc"`), `aria-pressed` for held, `aria-describedby` pointing at one
  hidden instructions paragraph.
- **Arrows move focus spatially** when nothing is held: nearest magnet whose
  centre is beyond yours on the primary axis, inside a 1:1 cone, scored
  `primary + 2 x cross`. Measured on a 28-magnet board: 92% of cone hops are
  reversible, 19/112 directions are dead ends, and **all 28 magnets are
  reachable from the first by arrows alone**.
- Two cheap corrections make it feel right, both in the prototype:
  1. **A focus trail** - if the next arrow is the opposite of the last one, go
     back where you came from. This masks the 8% non-reversibility, which is
     the thing that would actually feel broken to a child.
  2. **Reading-order fallback** when the cone is empty (top-to-bottom in 60px
     bands, left-to-right within a band). Dead directions drop from 19/112 to
     3/112 (the two ends of the order).
- `Home` / `End` jump to first / last in reading order.
- An **empty board** still needs a landing spot: put `tabIndex=0` on the
  surface itself with an "the fridge is empty, add magnets from the tray"
  label. Not prototyped.

### 2. The key mapping, and the physics

| Key | Not held | Held |
| --- | --- | --- |
| `Tab` / `Shift+Tab` | leave / enter the board (one stop) | - |
| Arrows | move focus to the nearest magnet that way | move the magnet 24px |
| `Shift`+arrows | - | move the magnet 96px |
| `Space` / `Enter` | pick up | drop |
| `Escape` | deselect | cancel, restoring the whole board |
| `R` / `Shift+R` | turn 15 deg clockwise / anticlockwise | same |
| `Delete` / `Backspace` | remove, focus moves to the nearest survivor | - |
| `Home` / `End` | first / last in reading order | - |

**Per-keypress movement drives `relax()` unchanged - the big finding.** A
keyboard step is just `moveDrag` with an absolute target, exactly what the
pointer path dispatches, so the held magnet is `activeId` (immovable) and its
neighbours take the full push. Measured in the browser on the seed row: six
`ArrowRight` presses walked E from x=341 to 485 and plowed `L`, `L`, `O` from
397/453/509 to 535/585/637. The bump is not simulated for the keyboard - it *is*
the bump.

Cost is a non-issue: `moveDrag` + `relax(passes=7)` measures **0.014 ms at 20
magnets, 0.034 ms at 38, 0.098 ms at 68** - under 1% of a frame even on a
board far denser than anyone will build. OS key-repeat (~30/s) is nowhere near
a limit.

Step size, from measurement (`CANVAS_W=1080`, magnets ~52x60):

| step | presses to cross the door |
| --- | --- |
| 8px | 135 |
| 24px | 45 |
| 96px | 12 |

24px (about half a magnet) as the default and 96px on `Shift` is the right
pair. **Do not offer a sub-24px "fine" step** - it would invert the usual
design-tool convention for no gain, because `relax()` routinely displaces
magnets by tens of px anyway, so a 4px precision claim would be a lie on this
board.

**Rotation needs one small thing.** `wheelRotation`'s 7 deg step means 13
presses per quarter turn - too many - and naive `rot + 15` never lands on a
right angle, because `spawnPlacement` jitters new magnets by up to +/-7 deg
(measured: `0.44 -> 15.44 -> ... -> 90.44`). Quantise then step
(`round(rot/15)*15 + 15`) and it lands exactly on 90. That is a 3-line
`stepRotation(rot, dir, step = 15)` in `magnet-kit` - **the only engine
addition the whole feature wants**, and it belongs there per the app's
engine-boundary rule. The prototype kept it app-side to honour the spike
constraint.

**Cancel needs one new reducer action.** Escape cannot be built from the
existing actions. Measured: moving the held magnet back to its pick-up point
restores *it* exactly but leaves the neighbours it shoved displaced - in one
run a neighbour stayed 262px out of place. `relax()` is not invertible. The fix
is a `cancelDrag { magnets }` action that restores the pick-up snapshot
wholesale (~4 lines of reducer, one ref in the hook), verified in the browser:
after Escape, every magnet in the row is back at its original x.

### 3. Tray to board, no drag

**This already works from the keyboard today** and needs no new interaction.
The tray tiles are real `<button>`s, and `onAdd` -> `buildAddAction` ->
`findOpenPlacement` already picks an open spot near the top-centre and
auto-selects the new magnet. Confirmed: pressing `Enter` on the tray's `K` tile
added a magnet at x=520. Three gaps to close, all additive:

1. The new magnet becomes the roving-tabindex target, so Tab goes straight to
   it.
2. It gets announced ("Added green letter K to the top centre, column 5, row 2.
   Press tab to go to the fridge.").
3. **Focus should stay in the tray**, not jump to the board - kids add several
   magnets in a row, and stealing focus would break that. The announcement
   tells them how to follow.

### 4. Announcements

One visually-hidden instructions paragraph (referenced by every magnet's
`aria-describedby`) plus **one** `aria-live="assertive" aria-atomic="true"`
region for the drag lifecycle. Position is reported as a 3x3 zone name *plus*
column/row on a coarse 10x7 grid - logical pixels are meaningless to a person,
and a zone alone is too vague to steer by. All of the below are real strings
the prototype emitted from real state:

- instructions: *"Press space to pick up. Arrow keys move the magnet, shift plus
  arrow moves further. Space drops it, escape puts it back. R turns it. Delete
  removes it."*
- pick-up: *"Picked up blue letter E. top centre, column 4 of 10, row 1 of 7.
  Arrow keys to move, space to drop, escape to cancel."*
- move: *"top centre, column 5 of 10, row 1 of 7. Bumped 3 magnets."*
- rotate: *"blue letter E turned to 15 degrees."*
- cancel: *"Cancelled. blue letter E back at top centre, column 4 of 10, row 1
  of 7."*
- drop: *"Dropped blue letter E. the middle, column 5, row 4."*
- remove: *"Removed blue letter E. 7 magnets left."*

Two things the copy must get right, both consequences of `relax()`:

- **Say what got bumped.** A sighted child sees the shove; a blind child needs
  to hear it, or the board silently rearranges under them. Naming one magnet
  and counting beyond that reads well.
- **Debounce the move announcements (~400ms after motion stops).** The
  prototype announces per keypress, which under key-repeat would fire ~30
  utterances a second into an assertive region - unusable. Drop and cancel
  should always announce immediately. This is the one part of the
  announcement design the prototype did *not* prove; treat it as a build
  requirement.

### 5. What the prototype proved, disproved, and surprised

Proved (all in a real browser, `apps/fridge/src/keyboardSpike.iwft.tsx` on the
throwaway commit):

- One tab stop for the board, maintained across move, delete and add.
- **Focus survives the relax-driven re-render** - the held magnet keeps DOM
  focus across six consecutive state updates. This was the main DOM-level
  unknown; keyed `MagnetView`s are never remounted, so it just works.
- Per-keypress `moveDrag` produces the real bump (144px of travel plowed three
  neighbours).
- `Shift`+arrow gives the 96px long step.
- Escape restores the whole row via the snapshot.
- `R` turns 3 deg -> 15 deg and lands on multiples of 15.
- `Delete` removes and moves focus to a survivor rather than dumping focus on
  `<body>`.
- The pointer path is untouched: the existing `verifyDragBumps` pointer
  drag-and-bump assertion still passes with all the keyboard wiring in place.

Disproved / corrected:

- **Escape cannot be synthesised from existing actions** (see above) - needs
  `cancelDrag`.
- **Naive rotation stepping is broken** by spawn jitter - needs quantisation.
- **`relax()` cost was never the risk.** The measurable cost is React
  re-rendering the magnet list, not the physics.
- Spatial nav is *not* perfectly reversible (92%), which is why the focus
  trail earns its keep.

Surprise worth writing down for the builder: `MagnetView.module.scss` slides
`left`/`top` over 0.13s for non-active magnets. Because `dragId` doubles as
"held", the held magnet correctly gets `transition: none` and tracks keypresses
1:1, while bumped neighbours slide - exactly the pointer feel. But it means a
bounding-box read taken immediately after a keypress reports the *pre*-transition
position, and rapid presses keep restarting the transition so it can appear
frozen. This cost real debugging time in the spike. **Assert on `style.left`,
not `boundingBox()`, in the build's tests.**

Also visual, from the screenshot: stacking a dashed "held" outline on top of
the existing `SelectionOverlay` ring reads as clutter at fit scale. The build
should add a `data-held` variant to `SelectionOverlay`'s ring rather than a
second outline on the magnet.

### 6. Build shape and size

| File | Change | Rough size |
| --- | --- | --- |
| `features/board/keyboardNav.ts` (new) | pure: spatial pick, reading order, focus-after-remove, cell/zone naming, announcement builders | ~110 lines |
| `features/board/keyboardNav.test.ts` (new) | unit tests for the above (reversibility, dead ends, copy) | ~90 lines |
| `features/board/useFridgeBoard.ts` | `focusId`, held = existing `dragId`, pickup snapshot ref, `cancelDrag` action, `onMagnetKeyDown`, `onMagnetFocus`, debounced announcer | ~130 lines |
| `features/board/useFridgeBoard.test.ts` | `cancelDrag` reducer cases | ~30 lines |
| `features/board/MagnetView.tsx` | `tabIndex`, role, `aria-roledescription`, `aria-label`, `aria-describedby`, `aria-pressed`, `onKeyDown`, `onFocus`, `data-magnet-id` | ~25 lines |
| `features/board/MagnetView.module.scss` | `:focus-visible` ring (inherits the magnet's rotation for free) | ~6 lines |
| `features/board/SelectionOverlay.tsx` + scss | `data-held` ring variant instead of a second outline | ~10 lines |
| `features/board/FridgeDoor.tsx` | `role="group"` + label; `tabIndex=0` on an empty surface | ~8 lines |
| `pages/FridgePage.tsx` | roving-target selection, hidden instructions, one live region | ~30 lines |
| `features/tray/PaletteGrid.tsx` or the hook | make the added magnet the roving target + announce | ~10 lines |
| `features/toolbar/TopBar.tsx` (+ `MobileBar`) | helper copy: "drag or use the arrow keys"; a keys popover is a separate nice-to-have | ~3 lines |
| `packages/magnet-kit/src/rotation.ts` + test | `stepRotation(rot, dir, step = 15)` | ~10 lines |
| `src/keyboard.iwft.tsx` (new) | one whole-frontend test: tab in, pick up, move, bump, cancel, rotate, delete, tray-add | ~90 lines |

**~450-550 lines, one PR**, comparable to the share/import PR. No ADR strictly
needed, though the focus model (roving tabindex + spatial arrows + trail) is
worth a short one since it is a reusable house decision - espy and karesansui
have the same class of problem.

Sequencing note: the pointer experience is not distorted anywhere, because the
keyboard reuses `dragId` as "held" and therefore inherits the same `active`
styling and the same `moveDrag`/`relax` path. The only shared-file risk is the
`cancelDrag` action, which is additive.

### Recommendation

**Go.** Write the build ticket. Two things must be in it explicitly, because
they are the parts the spike found rather than assumed: the **debounced**
live-region announcer (naming what got bumped), and `cancelDrag` restoring the
pick-up snapshot. Both are small; both are invisible in a naive implementation
and would make the feature feel broken without them.

Sources: [aria-dropeffect (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-dropeffect),
[aria-grabbed (MDN)](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-grabbed),
[dnd-kit accessibility](https://docs.dndkit.com/guides/accessibility),
[dnd-kit keyboard sensor](https://dndkit.com/extend/sensors/keyboard-sensor).
