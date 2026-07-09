# 0020 — karesansui: "many pens, one garden" model (planetary marbles)

- **Status:** Accepted
- **Date:** 2026-07-09
- **Related:** [0008-karesansui-many-pens-model.md](../plans/0008-karesansui-many-pens-model.md)
  (the implementation plan); **supersedes in part**
  [0018-karesansui-geometry-fidelity.md](0018-karesansui-geometry-fidelity.md)
  (the summed-cosine sand model + the mechanism half of Level-2 pen-fidelity) and
  [0019-karesansui-architectural-redesign.md](0019-karesansui-architectural-redesign.md)
  §mechanism (the epicycle arm-chain); [0008-apps-without-a-database.md](0008-apps-without-a-database.md)

## Context

karesansui drew **one** summed-cosine curve (`geom()`): adding a cog enriched a
single pen's path, and the mechanism drew that pen at the tip of an epicycle
arm-chain. For 2+ cogs the pen is the vector sum of the terms and sits on **no**
single cog, so it visibly floated free of the gears — honest to the maths, but it
read as a glitch, not a machine. A rake head (1–7 tines) carved the single curve.

The pivot (validated in the layout-spikes artifact): make it a **traditional
automated zen garden**. Each cog becomes an independent planet rolling in the
ring, carrying **its own single marble** that grooves **its own line**. N cogs →
N overlapping single-wheel rosettes on one flat bed. The multi-tine rake retires
as a drawing tool and returns as an optional **clearing rake** that sweeps the
bed smooth, so the machine can draw and reset forever.

## Decision

1. **Independent planets, not a summed pen.** `gardenCurves(config, boardR)`
   builds one single-wheel rosette per cog `i`: `carrierAmp = R − wᵢ`,
   `a = offset·wᵢ`, `f = (R − wᵢ)/wᵢ`, rigidly rotated by `phaseᵢ = i·2π/N`, all
   on one shared fit scale so relative sizes stay true. Each is an honest
   single-wheel spirograph — maths we already trust. `N = 1` reproduces the old
   single-wheel curve exactly (regression anchor).
2. **One marble per cog.** A groove is one stroke (shadow + highlight + core),
   not N tines. Groove weight is a fixed style constant. The rake-head presets
   (`rake.ts`) are retired.
3. **Clearing rake is a separate, optional tool.** When on, `useRakeLoop` runs a
   perpetual **draw → sweep-clear → redraw** loop; when off it draws once and
   holds. Default off, so the calm "draw once" behaviour is the resting state.
4. **Planetary mechanism.** `MechRenderer` draws N cogs rolling in the ring, each
   with a gear, a spoke, and its marble — one gear + one marble per groove.
   `drawGear`/`drawRing` are still the verbatim reference primitives.
5. **`geom()` is retained only for reference / the N=1 anchor** — it is no longer
   the sand's source of truth and always draws the full closed period now.
6. **Controls:** Play / Clear / Download; a clearing-rake toggle; a single global
   offset (scales every marble); the cog train caps at 4 (each a pen); the
   rotations slider is dropped (each cog runs its full period); saved gardens
   move to a burger menu with inline rename. Preset schema bumps to **v2**
   (`karesansui:presets:v2`) with a one-way v1→v2 migration that drops
   `rake`/`turns`.

## Consequences

- Adding a cog now adds a **visible, distinct groove**, matching the mental model
  ("more cogs → more lines") the summed curve violated.
- The mechanism is honest again: every marble sits on its own gear; nothing
  floats free. The arm-chain, tine presets, and summed-cosine sand code are gone.
- Full physical cog-on-cog **compound** gearing (planets meshing planets) is
  **not** done — the planets are independent (each rolls in the ring alone). That
  remains a possible future model.
- Old presets keep loading (migrated); the retired `rake`/`turns` fields are
  silently dropped.
