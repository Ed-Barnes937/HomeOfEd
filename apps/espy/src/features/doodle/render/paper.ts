/**
 * Procedural watercolour paper — PURE TS (no DOM, no canvas): it fills an RGBA
 * byte buffer that `render/surface.ts` wraps in an `ImageData` and blits.
 *
 * Implemented from the technique study
 * (`docs/reference/watercolour-technique/README.md` §5), not ported from any
 * source. Three fBm fields summed as signed deviations from 0.5 — coarse tooth,
 * fine grain, and an anisotropic fibre term sampled on a heavily stretched axis
 * so the sheet reads as laid paper rather than as noise — then a two-tap forward
 * difference of that height field for relief shading, a screen-space dither to
 * kill banding, and a warm tint composed in LINEAR light and gamma-encoded once.
 *
 * Everything here is a fixed constant, including the seed: the same sheet every
 * load. These are deliberately plain `const`s and NOT part of `fluid.tuning.ts` —
 * the paper has no tunable knobs (ticket 01).
 */

/** One fixed sheet, every visit. */
const SEED = 0x5e1f

/**
 * Flat paper (relief bias, no grain) as an sRGB hex — the colour the generated
 * sheet averages out to. Used as the immediate fill under the sheet blit, and
 * mirrored by `--espy-card` so the chrome behind the canvas matches.
 */
export const PAPER_FLAT = '#faf6ec'

// fBm. Lacunarity is 2.03 rather than 2 on purpose: a power of two aligns the
// octaves into a visible grid.
const OCTAVES = 5
const LACUNARITY = 2.03
const GAIN = 0.5

// Cold press — one hard-coded paper weight (the sensible default).
const TOOTH_SCALE = 9
const TOOTH_AMP = 0.55
const FINE_SCALE = 2.6
const FINE_AMP = 0.25
/** The fibre term: ~13:1 stretch is what makes it a laid sheet, not noise. */
const FIBRE_SCALE_X = 46
const FIBRE_SCALE_Y = 3.4
const FIBRE_AMP = 0.35

// Relief: a cheap fake normal map, light effectively from the top-right. The
// flat-paper bias sits just under 1.0, so flat paper is marginally darker than
// the raw tint.
const RELIEF_BIAS = 0.985
const RELIEF_GAIN = 5
const RELIEF_TAP = 0.7
const RELIEF_MIN = 0.9
const RELIEF_MAX = 1.05

/**
 * White noise, ±this, purely to kill banding in flat areas.
 *
 * DIVERGENCE from the study, which dithers in SCREEN space (`gl_FragCoord`).
 * The sheet is generated in CSS px and then upscaled to the device rect, so this
 * is sheet space and gets smoothed by that upscale. Acceptable here because the
 * tint has no gradient across the sheet to band in the first place (study §5:
 * "no vignette, no gradient — it is optically flat"); true screen-space dither
 * would need a second pass at device resolution, which is the cost the
 * CSS-resolution decision exists to avoid.
 */
const DITHER = 0.01

/**
 * Warm tint in LINEAR light — R and G close together, B dropping away. That
 * blue-channel drop is the whole "aged rag" impression. Flat paper (relief bias
 * 0.985) lands on `#faf6ec` = `PAPER_FLAT`.
 *
 * DIVERGENCE from the study's `[0.93, 0.905, 0.845]`, which gives a greyer
 * `#f5f2eb`. These are brighter and hold the same R−G : G−B ratio (≈1:2.4), so
 * the sheet stays as warm as espy's existing sketchbook palette rather than
 * dropping to the study's cooler rag — the ticket says the study's colours are
 * "not automatically right for our palette".
 */
const TINT_R = 0.972
const TINT_G = 0.938
const TINT_B = 0.856

const GAMMA = 1 / 2.2

// NOTE: `fluid.ts`'s display shader carries its own GLSL hash/value-noise for
// the ink granulation. Same idea, different language — they cannot share code,
// so a change to the feel of one is worth checking against the other.
function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + seed
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Plain hash-based value noise with a smoothstep fade. */
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy, seed)
  const b = hash2(ix + 1, iy, seed)
  const c = hash2(ix, iy + 1, seed)
  const d = hash2(ix + 1, iy + 1, seed)
  const top = a + (b - a) * ux
  const bottom = c + (d - c) * ux
  return top + (bottom - top) * uy
}

/**
 * All 5 octaves run, including the ones whose cell falls under a pixel (the fine
 * field's last few, and the fibre's across-the-grain axis). That is deliberate:
 * they degenerate into a stable per-pixel hash, which reads as the finest dust
 * of the tooth rather than as artefact — the seed is fixed so nothing shimmers,
 * and the sheet is generated in CSS px then upscaled by dpr, which low-passes
 * them anyway. Cutting them off at Nyquist was tried and looks chunkier.
 */
function fbm(x: number, y: number, seed: number): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let px = x
  let py = y
  for (let o = 0; o < OCTAVES; o++) {
    sum += vnoise(px, py, seed + o * 7919) * amp
    norm += amp
    amp *= GAIN
    px *= LACUNARITY
    py *= LACUNARITY
  }
  return sum / norm
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Encode a linear-light channel to an sRGB byte. */
function encode(linear: number): number {
  return Math.round(255 * Math.pow(clamp(linear, 0, 1), GAMMA))
}

/**
 * The height field — tooth + fine grain + anisotropic fibre, summed as signed
 * deviations from 0.5.
 */
function paperHeight(w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tooth = fbm(x / TOOTH_SCALE, y / TOOTH_SCALE, SEED)
      const fine = fbm(x / FINE_SCALE, y / FINE_SCALE, SEED + 23_701)
      const fibre = fbm(x / FIBRE_SCALE_X, y / FIBRE_SCALE_Y, SEED + 31_101)
      out[y * w + x] = clamp(
        0.5 + (tooth - 0.5) * TOOTH_AMP + (fine - 0.5) * FINE_AMP + (fibre - 0.5) * FIBRE_AMP,
        0.02,
        0.98,
      )
    }
  }
  return out
}

/**
 * Generate one sheet of paper as RGBA bytes, `w × h`, fully opaque.
 *
 * Cost is ~15 value-noise samples per pixel, so callers generate ONCE per size
 * (and at a capped resolution — see `PAPER_MAX_PX` in `surface.ts`), never per
 * frame: this runs on phones.
 */
export function generatePaper(w: number, h: number): Uint8ClampedArray {
  const height = paperHeight(w, h)
  const rgba = new Uint8ClampedArray(w * h * 4)

  for (let y = 0; y < h; y++) {
    const up = y > 0 ? y - 1 : 0
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const centre = height[i]!
      const right = height[y * w + (x + 1 < w ? x + 1 : x)]!
      const above = height[up * w + x]!
      // Two-tap forward difference — grain reads as a lit surface, not speckle.
      const shade = clamp(
        RELIEF_BIAS +
          RELIEF_GAIN * (-(right - centre) * RELIEF_TAP - (above - centre) * RELIEF_TAP),
        RELIEF_MIN,
        RELIEF_MAX,
      )
      const lit = shade + (hash2(x, y, SEED + 907) - 0.5) * 2 * DITHER
      const o = i * 4
      rgba[o] = encode(TINT_R * lit)
      rgba[o + 1] = encode(TINT_G * lit)
      rgba[o + 2] = encode(TINT_B * lit)
      rgba[o + 3] = 255
    }
  }
  return rgba
}
