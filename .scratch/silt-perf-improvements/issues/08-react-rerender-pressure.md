# 08 — React re-render pressure: the rail, the overlay, the status bar

**Status:** wontfix
**Type:** task
**Spec:** [../spec.md](../spec.md)

`HomePage` is one component holding every piece of state, and two of those
pieces change constantly:

```ts
onCursorChange: setCursor,   // fires on EVERY pointermove
onFps: setFps,               // fires 4x/second
```

`setCursor` re-renders **the whole page** — the header, all seventeen palette
swatches with their groups, the brush picker, the mode toggle, the overlay and
the status bar — once per pointer event. On a trackpad reporting at 120 Hz that
is 120 full reconciles a second, landing on the same frames the sim and the
renderer are competing for. On the reference machine this is very plausibly the
single largest frontend cost in the app.

`setFps` does the same four times a second for a number in the corner.

## What to change

**Split the tree so the constantly-changing state re-renders only what depends
on it.** The rail is entirely static between clicks: it depends on `palette`,
`selectedElement`, `tool`, `mode` and `brushIndex`, and on none of
`cursor`/`fps`/`spawners`.

- Extract the rail into its own component and wrap it in `React.memo`. Its
  props must be stable — `selectElement` and `selectErase` are currently
  recreated every render, so they need `useCallback` (or to be lifted to
  setter-only forms) or the memo buys nothing.
- Same for the status bar, or at least for the FPS readout: `fps` should not be
  able to re-render anything but the span it prints in.
- `WorldOverlay` is the one thing that *should* follow the cursor. Its `fit`
  prop is `controls`, a **fresh object literal returned from `useSimLoop` on
  every render** — so memoising the overlay does nothing until that is stable.
  Wrap the returned controls object in a `useMemo`/`useCallback` set, or pass
  the two functions the overlay actually needs (`gridToCanvasPoint`,
  `cellSize`) as separately stable references. The `WorldFit` type already says
  those two are all it wants.

**Also fix an O(n²):**

```ts
const nth = palette.entries.indexOf(entry) + 1     // inside .map, inside .map
```

and in `paletteGroups.ts`:

```ts
colourOf: (id) => entries.find((entry) => entry.id === id)?.colour,
nameOf:  (id) => entries.find((entry) => entry.id === id)?.name ?? '',
```

`colourOf` is called from `WorldOverlay` **per spawner, per render** — so per
spawner per pointermove. Build an id→entry `Map` (or a 256-slot array, same
argument as ticket 02) once in `buildRailPalette`, and give each entry its
index at build time so the hotkey number is a field rather than a search.

## Consider, and decide explicitly

Driving the brush cursor **imperatively** — writing `style.left`/`style.top` on
a ref'd div from the pointer handler and keeping `cursor` out of React state
entirely — removes the per-event re-render at the source rather than
containing it. It is the bigger win and the bigger change: the status bar's
cursor readout also reads `cursor`, so it would need the same treatment.

Do the memoisation work first and measure. Then say in the PR whether the
imperative version is still worth it. **Do not do both speculatively.**

## Watch out for

- **`React.memo` with unstable props is a pure loss** — an extra comparison
  every render and no skip. Verify the memo actually skips: React DevTools
  Profiler, or a temporary render counter, and report what you saw.
- StrictMode double-invocation is on in dev. Do not chase a doubled count.
- `apps/silt/CLAUDE.md` has a rule about latest-value refs syncing in a
  `useEffect`, never during render (ticket 15). Anything you add here obeys it.
- The `.iwft` suites (`render`, `chrome`, `scenes`, `spawners`, `mobile`) drive
  this page through the real DOM. All five must stay green — they are the only
  thing standing between a memo boundary and a stale UI.

- [ ] The rail does not re-render on pointer move (verified, not assumed — say how)
- [ ] The FPS readout does not re-render the rail or the overlay
- [ ] `useSimLoop`'s returned controls are referentially stable
- [ ] `colourOf`/`nameOf`/hotkey index are O(1), not a scan per call
- [ ] An explicit, measured decision on the imperative brush cursor
- [ ] All five `.iwft` suites green
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green

## Answer — wontfix

Done. The rail is a memoised `ToolRail` with `useCallback`-stable props,
`WorldOverlay` is memoised, `useSimLoop`'s controls are `useMemo`d, and
`colourOf`/`nameOf`/the hotkey index are O(1) off a build-time `Map`.

Measured in the CT harness with temporary counters:

| Scenario | Rail | Overlay |
| --- | --- | --- |
| 100 pointer moves, before | 73 | 71 |
| 100 pointer moves, after | **0** | 69 |
| 3 s of FPS ticks, before | 8 | 6 |
| 3 s of FPS ticks, after | **0** | **0** |

**The ticket's headline claim did not survive measurement.** React was not "very
plausibly the single largest frontend cost" — at 0.060 ms per pointer move it
was already smaller than the rasterise loop and ~20× smaller than one sim tick.

Imperative brush cursor **declined**, on measurement: after memoisation a move
costs 0.038 ms of which React is 0.034 ms, so that is the entire ceiling —
under 2% of the frame budget, against moving four pieces of chrome to
imperative DOM writes.

**Closed `wontfix` after measurement.** The work was done and green, and it did
what it claimed. It is not landing because the saving is ~0.15 ms/frame on the
reference machine while `React.memo` boundaries are a permanent stale-UI hazard
on a page five `.iwft` suites exist to protect — that trade did not clear the
bar. The disproof of the audit's "single largest frontend cost" claim is the
part worth keeping, and it is recorded in the map and the spec.

The `paletteGroups.ts` cleanup inside this ticket (linear `entries.find` in
`colourOf`/`nameOf`, and `entries.indexOf` inside two nested `.map`s in
`HomePage`) is sloppy independent of any React question and may deserve its own
small ticket.
