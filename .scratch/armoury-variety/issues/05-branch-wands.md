# 05 - Branch wands: bent spine, organic noise, knots

**Status:** needs-triage
**Type:** task
**Spec:** [../spec.md](../spec.md)
Blocked by: 02 (its answers shape this ticket), 04 (sequencing: gems must bend too)

The first wand that isn't a straight turned stick. **Rewrite this ticket from
02's Answer before building**; what follows is the expected shape, not a
commitment. Status goes to `ready-for-agent` once that's done.

## Expected shape

- **Spine**: a gentle curve the straight wand is mapped onto after it's built
  (the spec's "bend after building" decision). Parameters a kid sees: how
  bent, how wiggly. Curated so it never self-intersects or looks melted.
- **Organic noise**: low-frequency radius noise and a few knots, seeded from
  the params so the same wand always comes out the same.
- **A "Kind of wand" picker** at the top: Turned (today's wand) and Branch,
  each with its own sensible defaults and the controls that make sense for it,
  if 02 says the two don't mix.
- **Everything else bends with it**: grooves, nodes (01), material zones (03)
  and gems (04) are authored straight and passed through the same spine.
- **Downstream fixes** from 02's list: box fitting, close-look grip, wave, tip
  glow, share picture.
- Benchmarks: Bellatrix, Harry's handle, Neville's handle, Dumbledore (with
  01's nodes), c1 (with 04's gems), c4.

## Done when

- Unit tests: the bent mesh is closed and finite, never self-intersects across
  the parameter ranges, and the same params give the same wand.
- iwft covers the kind picker and that old saves open as Turned.
- Ed has rolled branch wands on a real GPU and they read as wood, not tubing.
- Verify loop green. ADR for the spine model and the kind picker.

## Comments
