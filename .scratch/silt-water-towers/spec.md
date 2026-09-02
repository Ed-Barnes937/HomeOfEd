# silt-water-towers - pouring water stacks into standing towers

Pouring a lot of water in one spot grows a wide standing block with vertical
faces that persists for hundreds of ticks after the pour stops (screenshot in
the 2026-09-02 session; reproduced headlessly - harness notes below). This
effort is the diagnosis and the one fix that survived it.

## Diagnosis (all measured, seed 1, headless harness over `src/sim`)

Three stacked mechanisms, two of them ours:

1. **The stream itself is a saturated column - physical, not a bug.** Water
   falls 1 cell/tick, so a continuous pour fills its columns to density 1
   (inflow = width x fall speed). Sandspiel streams are equally dense.
2. **A body of water sheds only through its top surface layer,** at a rate
   independent of the body's size (~2-4 cells/tick for any width). Cells
   stripped off the top walk to the edge, fall, and form a one-cell curtain
   hugging the vertical faces, which keeps the face cells' down-diagonals
   blocked: after every tick, zero water cells anywhere hold an open down or
   down-diagonal move. Pour inflow (~5 cells/tick) therefore beats shedding,
   and the block grows for as long as the pour runs, then erodes edge-inward
   at ~1 column/tick/side (a 30x40 block still shows excess 6 after 300 ticks).
3. **Something in chunk sleeping / deferred moves makes it worse.** A
   chunk-free reimplementation of the same kernel levels the 30x40 block to
   max 9 within 50 ticks with either kernel; the real engine holds ~29 at
   t=50 and ~20 at t=300. Not yet root-caused - see ticket 01, which must
   characterise this before the fix lands. (An earlier probe exonerated
   sleeping only for cells with open *gravity* moves; surface cells with open
   *lateral* moves were never checked.)

Exonerated: the opinion field (ADR 0038). Forcing the pre-epic coin-flip
lateral produces an identical pour tower (towerExcess 178 both ways), though
the opinion commitment does slow post-pour levelling (known since the ticket
01 prototype of silt-sandspiel).

## Why sandspiel does not tower

Its `update_water` is structurally the kernel we already have (fall, both
diagonals, lateral scoot with parity + momentum), and its scoot is 2 to our
dispersion 5 - so the lateral rule is not the difference. What sandspiel has
that silt lacks is the Navier-Stokes wind field: `tick()` runs `blow_wind`
over every cell before the CA pass, and a heavy pour's splash pressure pushes
water outward, breaking columns up. Ruled out of scope for silt in
`.scratch/silt-sandspiel/spec.md`, and this effort does not reopen it.

## The fix: momentum steers the fall (ticket 01, ADR 0041)

A liquid that still has momentum in `ra` falls diagonally in its parity
direction, spending one momentum per step, instead of straight down. Only
cells that recently flowed laterally carry momentum, so the nozzle stream
still falls straight, but cells stripped off a plateau edge are thrown clear
in an arc instead of curtaining down the face - unblocking the face diagonals
so the block sheds from three surfaces instead of one.

Prototype numbers (same harness): post-pour remnant tower at settle t=200
excess 18 -> 6; 30x40 block excess at t=100 21 -> 10, at t=150 18 -> 5; the
standing plateau at pour end is gone (stream + spray + low cone remain). The
whole silt vitest suite (231) passed with the prototype in place, unedited -
settling, sealed pocket, determinism included. No new bytes, no extra RNG
draws.

Demo (local-only, not committed): `prototype-drift-fall.html` in this
directory - the real `src/sim` bundled twice, baseline vs patched, same seed,
side by side. Ed ran it 2026-09-02 and validated the feel.
