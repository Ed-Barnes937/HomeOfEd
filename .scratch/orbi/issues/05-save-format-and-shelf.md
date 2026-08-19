# 05 — Save format and the planet shelf

**Type:** grilling
**Status:** open
**Blocked by:** 02

## Question

orbi is stateless (ADR 0008; standing choices in the map's Notes) — planets
live in the browser. Define:

1. **The planet document**: shape and versioning. Follow boop's pattern
   (ADR 0025, `apps/boop/src/persistence/saveFormat.ts`): version inside the
   document, unknown versions degrade gracefully. What exactly is saved —
   dials, chapter, life state, orbit day, last-visited — and what is derived
   on load rather than stored?
2. **The shelf index**: many planets + search (design: `2a Planet shelf` in
   the handoff README) — one index document vs key-per-planet (silt's
   `sceneStore.ts` pattern), quota handling, thumbnail strategy (re-render on
   load vs stored image).
3. **Storage seam**: injected `Pick<Storage, ...>` interface + fake, per house
   pattern; localStorage vs IndexedDB if planet documents turn out large.
4. Autosave cadence while the sim runs (boop's debounced `autosave.ts` as
   prior art).

Run with `/grilling` + `/domain-modeling`.

## Answer
