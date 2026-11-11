# 0099 - armoury smithy stage: steel, leather, the smithy's light, tone mapping, assets

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** [ADR 0098](0098-armoury-sword-generator.md) (the generator this stage draws),
  [ADR 0076](0076-armoury-generator-tuning.md) (baked scan means, never read back),
  [ADR 0082](0082-armoury-material-zones.md) and [ADR 0083](0083-armoury-glowing-gems.md) (the bloom cap
  at rest), [ADR 0077](0077-armoury-close-look.md) (the close look's rig).

## Context

The owner's bar (decision E5) is that a sword looks as real as a wand does. The wand's stage
is tuned for wood: no tone mapping (the composer turns it off, so light over 1.0 clips), a
512x256 studio map at 0.45, one warm key and a cool rim. Wood hides all of that; polished steel
shows every one of them as flat grey, blown white or a black mirror. The wand's canvas must not
change, so the sword gets its own canvas settings.

## Decision

### Its own canvas

- `SwordStage.tsx` (box) and `SwordCloseUpStage.tsx` (close look, on the shared `HeldRig`) are a
  second lazy entry. Rollup puts three, R3F, drei and postprocessing in a shared chunk; a
  wand-only visit loads no sword code, texture or HDRI.
- The composer is the wand's bloom (threshold 1.4, intensity 1.1, radius 0.7) followed by an AgX
  `ToneMapping` effect, so reflections roll off instead of clipping. `postprocessing` is a direct
  dependency at the version the lockfile already had (6.39.6). The picture skips the composer, so
  `capture()` sets the renderer's own AgX tone mapping for that one render.
- Framing (decision O3): the longest sword spans `STAGE_FILL` of the stage at its own size
  (`SWORD_HALF_WIDTH`); every other sword is drawn `drawnFraction(L) * LONGEST / L` times larger,
  matching the drawn shadow. The close look gets `boxHalfWidth / boxScale` so the lift starts
  exactly where the sword lay.
- The mesh is built once at mount, then on each change of the spec at most once per animation
  frame from the latest spec (`latestOnly`), reusing the GPU buffers when the sizes match. A
  whole sword takes 9-37 ms on an M3 and 3-4 times that on a phone, so a dragged slider would
  otherwise stall every input event.

### Light and environment

- `SmithyLights`, in the same frame as `ShopLights` so the close look's handoff maths holds:
  the forge key from the low left (`[-4, 1.6, 0.6]`, `#ff8a33`, 2.6, with a 3-5% slow flicker
  that is off under reduced motion), the window from the high right rear (`[2.5, 4, -3]`,
  `#bcd4ff`, 1.6) and a cool rim from behind (`[0.5, 1, -3]`, `#cfd8ff`, 0.6) that the close
  look fades out as it rises.
- `SmithyEnvironment`: drei's `Environment` portal at 512 over a CC0 cellar map (at 1.5, turned
  so its bright doorway is up, right and behind, where the anvil's reflections look), with
  lightformers laid over it: the forge strip low on the left, the window high right and behind, a
  soft strip high in front, a framed overhead softbox for the anvil, and for the close look a
  wide dim neutral fill whose 2-D falloff runs bright above to dim below and along the blade, with
  a small hard-edged softbox over it, so a flat held up sweeps from a light zone to a dark one and
  Mirror shows an edge that Satin blurs. Thin warm (`#ffc890`) and cool strips with falloff along
  their length sit where each edge bevel looks, so each edge reads as a line of light that moves
  as it rolls. Every intensity is in `ENV` in `smithyScene.tsx`.
- Decision O7 was triggered at G2 round 1: over the studio map, Mirror steel had nothing to
  reflect but bars of light and went black flat-on. Poly Haven `castle_zavelstein_cellar`
  (1024x512, 1.6 MB, CC0) replaced it as `public/hdri/smithy.hdr`, for the sword canvas only.
  The first turn put its brick vault where the close look's camera looks and turned plain steel
  bronze (G2 r3); the neutral fill is the answer to that.

### Materials (`stage/swordMaterials.ts`)

- Blade: `MeshPhysicalMaterial`, metalness 1, anisotropy along the blade
  (`anisotropyRotation` pi/2: the tangent comes from the blade's mm UVs), one row per finish from
  research 5.2 (`STEELS`), patterns as procedural rows (`PATTERNS`). One `onBeforeCompile` patch
  carries: the ambientCG `Metal009` brushed scan as roughness variation and slope-based relief in
  mm (tile and depth per finish; polished steel ignores it), grind streaks in two octaves and slow
  polish zones along the blade in both reflectance and roughness (`grain.grind` per finish),
  honed bevels, procedural hammer dishes on Black (none on the ground edge or in fullers), the
  fuller's darkening, roughness and a dark lip, cavity shade (`aShade`), patina, edge pits and
  scratches with wear, a bright bare edge on
  Black and Blue (no thin film on it), Ripples and the temper line (with nie), and the rune and
  engraving masks as emissive, relief and darkening. Every value that changes is a uniform, so
  one program serves every sword.
- The bloom cap at rest (`REST_CAP = 0.92 * BLOOM_THRESHOLD`) is a soft knee from 0.6 of the
  cap, not a clamp: a clamp flattened every highlight into one tone. Nothing at rest exceeds the
  cap, so nothing blooms; ticket 10 raises the blade's uniform for the glint.
- Fittings: `MeshPhysicalMaterial` per metal (`FITTINGS`: the wand's four shared metals plus
  iron, bronze and blue; blue is bright steel under a thin film, not the blade's near-black), the
  same steel scan at a smaller tile, tarnish in the creases from `aShade`, deeper with wear.
- Leather, cord and the Katana's braid: scan colour recentred on its baked linear mean and on
  undyed leather `#c7a77c`, then dyed by Beer-Lambert absorbance (`GRIP_DYES`, `dyeFor`) that
  soaks deeper in the scan's dark creases, so a coloured grip is dyed leather rather than a
  tint; roughness from the scan about its baked mean; relief from the height scan. Rayskin under
  the Katana's wrap is procedural nodules; the braid takes its dye 1.6x deeper. With wear the grip
  darkens and polishes where the hand sits. Wire grips are the fittings metal; ribbed grips are
  bone (the wand's colour, with a mottle and pores); wood grips go through the wand's own
  `addFinish` with walnut.
- Gems reuse the wand's `stoneGeometry` and `gemMaterial` at their rest glow.

### Assets

CC0, converted with `cwebp` (colour 1024 at q 78-82, data maps 512 at q 82), wrap, anisotropy
and colour space set as they load, means baked in `SCAN_MEANS`:

| File | Source | Size |
|---|---|---|
| `steel-rough`, `steel-height` | ambientCG Metal009 | 20 + 49 KB |
| `leather-colour`, `-rough`, `-height` | Poly Haven fabric_leather_02 (rolled so its seam lies under the grip) | 220 + 89 + 6 KB |
| `cord-colour`, `-rough`, `-height` | ambientCG Rope001 | 75 + 21 + 13 KB |
| `weave-colour`, `-rough`, `-height` | ambientCG Fabric031 | 166 + 9 + 78 KB |
| `hdri/smithy.hdr` | Poly Haven castle_zavelstein_cellar, 1024x512 | 1.6 MB |

Sword textures total 776 KB (budget 900 KB, none over 250 KB).

### Gate tuning and cuts

Recorded round by round in ticket 08's Comments; every review is in
`.scratch/armoury-swords/shots/08/g<N>/r<M>/review.md`, written by a fresh reviewer.

- G1 clay, three rounds, PASS: the Katana's point sweeps on its edge with a yokote crease,
  rounded tips close in one arc, flame waves at most 1.5 mm a side, the clipped point cut from
  the back, thin tapered langets, a Petersen lobed pommel, fewer risers, a higher shinogi, a
  smaller ball pommel. Nothing cut.
- G2 steel and environment, five rounds, PASS: the cellar HDRI (O7), soft-knee cap, the close
  look's graded fill and framed softbox, Blue as blue-black with a sheen, Black hammered, Ripples
  without relief artefacts, a misty wandering temper line. Nothing cut (Blue, Ripples and the
  temper line kept).
- G3 fittings and extras, two rounds, PASS with cuts: bone, wear, blued fittings, braid relief,
  gems at 0.5 of their seat (wheel and cap pommels 1.2x), flat runes at 0.12 of the base width,
  Glenmoor's and Ember Wave's guards retuned. **Cut:** the engraving tiles `knotwork`, `scales`
  and `dots` (still a visible rectangular panel after the fix round); `vine` stays, and
  Anvilheart and Quillfeather lost their engraving. The Katana and the Rapier pass as Kinds.

## Consequences

- Two WebGL contexts in the close look, as with the wand; the sword's stage adds about 2.4 MB of
  textures and HDRI on first visit to the smithy.
- Any change to the smithy's light must keep `SmithyLights` and the drawn anvil (ticket 11) in
  agreement: forge low left, window high right.
- The dev-only `?clay` and `?focus=tip|hilt` switches exist for the GPU gates and are compiled
  out of production builds.
