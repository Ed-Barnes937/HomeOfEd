# 10 — The rail palette does a linear scan per lookup

**Status:** ready-for-agent
**Type:** task
**Spec:** [../spec.md](../spec.md)

Carved out of ticket 08, which was closed `wontfix`. This part is sloppy
independent of any React question, and it survives that ticket's cancellation.

Two scans in `apps/silt/src/features/palette/paletteGroups.ts` and
`apps/silt/src/pages/HomePage.tsx`:

```ts
// paletteGroups.ts — a scan of the roster, per call
colourOf: (id) => entries.find((entry) => entry.id === id)?.colour,
nameOf:  (id) => entries.find((entry) => entry.id === id)?.name ?? '',
```

```tsx
// HomePage.tsx — inside .map, inside .map
const nth = palette.entries.indexOf(entry) + 1
```

`colourOf` is called from `WorldOverlay` **per spawner, per render** — so per
spawner per pointer move. `indexOf` runs per swatch per render, and the roster
is seventeen elements and built to keep growing (spec §9).

**What to change:** build an id→entry `Map` once inside `buildRailPalette` and
resolve both accessors through it. Give each entry its rail index at build time
so the hotkey number is a field rather than a search.

**Two things ticket 08 established that this ticket inherits:**

- **It is worth more now that 08 was dropped, not less.** A memoised rail would
  have partly hidden the `indexOf` by not re-rendering; with no memo, the rail
  re-renders on every pointer move and the nested scan runs every time.
- **Do not widen the public `PaletteEntry` interface by accident.** Ticket 08
  added `index` as a required field on the exported type. `buildRailPalette` is
  the only construction site in the app today, so that happens to be safe — but
  prefer a narrower internal type, or say explicitly in the PR why the exported
  shape had to change.

This is small. It is not expected to move the bench — `paletteGroups` is not on
the sim path at all — so **do not claim a timing.** Justify it as removing a
scan from a per-pointer-move path, and leave it there.

- [ ] `colourOf` / `nameOf` / the hotkey index are O(1)
- [ ] The exported `PaletteEntry` shape is either unchanged or deliberately widened, with the reason stated
- [ ] `paletteGroups.test.ts` and `paletteRegistrySource.test.ts` green
- [ ] No timing claimed
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm --filter silt run test` green
