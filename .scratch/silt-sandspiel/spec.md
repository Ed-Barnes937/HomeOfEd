# silt-sandspiel — findings worth adopting from the sandspiel teardown

A comparison of Silt's engine against the algorithms in
[MaxBittker/sandspiel](https://github.com/MaxBittker/sandspiel) (Rust + wasm +
WebGL, MIT/Apache-2.0), from Ed's research write-up "Four Bytes Per Pixel"
(2026-08-27, local document). This effort is the three findings that survived
the comparison; the write-up's other techniques Silt either already has or
deliberately does better.

## Already matched — no tickets

4-byte cell over one flat buffer, in-place tick with a wrapping u8 clock
guard, alternating horizontal sweep, WALL sentinel at the border,
deterministic seeded PRNG, zero-repack cells→RGBA-texture rendering with a
shader palette lookup. Silt's chunk sleeping is strictly stronger than
sandspiel's per-cell early-outs, and Silt's `dispersion` walk covers what
sandspiel's water double-scoot does.

## The tickets

1. **Water directional persistence** (`issues/01`) — sandspiel water stores a
   preferred flow direction in a scratch byte, spreads it to neighbours on
   each successful move, and carries a small momentum counter. Silt's liquid
   kernel re-rolls its lateral direction every tick, which is exactly the
   "puddles vibrate instead of flowing" failure sandspiel's design names.
2. **Powder: one random diagonal, not both** (`issues/02`) — a wedged grain
   that escapes only 50% of frames is what produces rounded conical piles
   with a natural repose angle; trying both diagonals gives shallower,
   wedge-like piles. Silt tries both.
3. **`rb` colour variants** (`issues/03`) — flat single-colour species read as
   slabs; sandspiel modulates per-cell shading from a scratch byte. Silt's
   `ElementDef.colours` and the WebGL renderer's B-channel upload already
   declare this design — it was never implemented.

## Out of scope, recorded so they aren't relitigated

- **Gas as an isotropic walk with split/merge molecule counts.** A genuinely
  different motion model (no gravity term; `rb` holds a molecule count).
  Would change the gas archetype and fight colour-variant for `rb`. Revisit
  only if smoke/steam look wrong after ticket 03.
- **The GPU Navier–Stokes solver** (wind field, per-species wind thresholds,
  permeability classes, smoke as a continuous density field, async
  readback). One interlocking feature, not adoptable piecemeal, and it cuts
  across the SAB-worker architecture (ADR 0036). If wanted, that is its own
  epic starting from an ideate/spec conversation.
- **Column-major indexing.** Sandspiel needs it because its inner loop walks
  `y`; Silt's inner loop walks `x` over a row-major grid and already touches
  sequential bytes.
