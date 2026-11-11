import * as THREE from 'three'

import { srgbToLinear, type LinearRgb } from '../items/colour.ts'
import type { Fittings, Steel } from '../sword/families.ts'
import { swordSchema } from '../sword/swordSchema.ts'
import { METALS } from './metals.ts'
import { BLOOM_THRESHOLD } from './stage.ts'

// The smithy's materials: steel, fittings, grips. Base values from research 5.2 and 5.3.
// Every value that changes with the sword is a uniform, so one program serves every sword.

/** The brightest any surface may be at rest, so nothing on the sword blooms (ADR 0082). */
export const REST_CAP = 0.92 * BLOOM_THRESHOLD

export interface SteelRow {
  colour: LinearRgb
  metalness: number
  roughness: number
  /** Along the blade: highlights stretch with the grind. */
  anisotropy: number
  envIntensity: number
  /** Black and blue steel are ground bright along the cutting bevel. */
  bareEdge: boolean
  /** Heat-bluing's thin film. */
  iridescence: number
  /** The steel scan's tile along and across (mm), its relief (mm), its roughness swing, hammer dimples' depth (mm) and how strongly grind streaks and polish zones vary its roughness. */
  grain: { tile: [number, number]; depth: number; scratch: number; hammer: number; grind: number }
}

const BRUSHED = {
  tile: [140, 60] as [number, number],
  depth: 0.006,
  scratch: 0.08,
  hammer: 0,
  grind: 0.1,
}

export const STEELS: Record<Steel, SteelRow> = {
  satin: {
    colour: [0.58, 0.59, 0.6],
    metalness: 1,
    roughness: 0.27,
    anisotropy: 0.6,
    envIntensity: 1.3,
    bareEdge: false,
    iridescence: 0,
    grain: BRUSHED,
  },
  bright: {
    colour: [0.62, 0.63, 0.64],
    metalness: 1,
    roughness: 0.08,
    anisotropy: 0.05,
    envIntensity: 1.4,
    bareEdge: false,
    iridescence: 0,
    grain: { ...BRUSHED, depth: 0.0012, scratch: 0.008, grind: 0.02 },
  },
  // Forge-black: hammer dimples under the scale, the hollows darker and warmer.
  dark: {
    colour: [0.07, 0.08, 0.1],
    metalness: 1,
    roughness: 0.5,
    anisotropy: 0.2,
    envIntensity: 1,
    bareEdge: true,
    iridescence: 0,
    grain: { tile: [60, 25], depth: 0.015, scratch: 0.12, hammer: 0.5, grind: 0.08 },
  },
  silver: {
    colour: [0.95, 0.92, 0.84],
    metalness: 1,
    roughness: 0.2,
    anisotropy: 0.1,
    envIntensity: 1.3,
    bareEdge: false,
    iridescence: 0,
    grain: { ...BRUSHED, grind: 0.06 },
  },
  blue: {
    colour: [0.03, 0.055, 0.15],
    metalness: 1,
    roughness: 0.14,
    anisotropy: 0.4,
    envIntensity: 1.25,
    bareEdge: true,
    iridescence: 0.15,
    grain: { ...BRUSHED, grind: 0.05 },
  },
}

/** The thin film's thickness range, nm: blue with straw and purple only at grazing angles. */
export const BLUING_FILM: [number, number] = [250, 300]

/** The steel a bare edge is ground back to. */
export const BARE_EDGE: LinearRgb = [0.6, 0.61, 0.62]

export interface PatternRow {
  /** 0 keeps the plain steel; 1 draws the pattern's bands. */
  mix: number
  /** The pale band (or the temper line's hardened edge) and the dark band (or the body). */
  light: LinearRgb
  dark: LinearRgb
  roughness: [light: number, dark: number]
  /** Shader switch: 0 none, 1 ripples, 2 temper line. */
  kind: number
}

export const PATTERNS: Record<'plain' | 'watered' | 'temper', PatternRow> = {
  plain: {
    mix: 0,
    light: [0.6, 0.6, 0.6],
    dark: [0.6, 0.6, 0.6],
    roughness: [0.25, 0.25],
    kind: 0,
  },
  watered: {
    mix: 1,
    light: [0.62, 0.62, 0.63],
    dark: [0.54, 0.54, 0.55],
    roughness: [0.14, 0.36],
    kind: 1,
  },
  temper: {
    mix: 1,
    light: [0.62, 0.62, 0.62],
    dark: [0.45, 0.46, 0.5],
    roughness: [0.38, 0.14],
    kind: 2,
  },
}

export interface FittingsRow {
  colour: LinearRgb
  metalness: number
  roughness: number
  /** Blued fittings: a thin oxide film over bright steel. */
  iridescence?: number
}

const shared = (key: string): FittingsRow => {
  const m = METALS[key]!
  return { colour: srgbToLinear(m.colour), metalness: m.metalness, roughness: m.roughness }
}

/** The wand's four metals, so a wand and a sword in the same metal match, plus iron, bronze and blue. */
export const FITTINGS: Record<Fittings, FittingsRow> = {
  iron: { colour: [0.56, 0.57, 0.58], metalness: 1, roughness: 0.35 },
  darkIron: shared('darkIron'),
  brass: shared('brass'),
  bronze: { colour: [0.55, 0.36, 0.18], metalness: 1, roughness: 0.4 },
  silver: shared('silver'),
  gold: shared('gold'),
  blue: { colour: [0.12, 0.17, 0.34], metalness: 1, roughness: 0.3, iridescence: 0.5 },
}

/** Undyed leather, linear: the pale scan is recentred on this, then dyed. */
export const LEATHER_BASE: LinearRgb = srgbToLinear('#c7a77c')

/** Beer-Lambert absorbance that dyes the undyed base onto a grip colour (linear). */
export function dyeFor(colour: LinearRgb): LinearRgb {
  return colour.map((c, i) =>
    Math.max(0, -Math.log(Math.max(c, 1e-4) / LEATHER_BASE[i]!)),
  ) as LinearRgb
}

const gripColourOptions = (() => {
  const param = swordSchema.params.find((p) => p.key === 'gripColour')
  return param?.kind === 'choice' ? param.options : []
})()

export const GRIP_DYES: Record<string, LinearRgb> = Object.fromEntries(
  gripColourOptions.map(({ value, swatch }) => [value, dyeFor(srgbToLinear(swatch!))]),
)

export const BONE: LinearRgb = srgbToLinear('#e6dbc2')
export const RAYSKIN: LinearRgb = [0.8, 0.78, 0.72]

// Scans: CC0 (README). Means are measured once from the webp files and baked here.
export const SWORD_TEXTURES = {
  steelRough: '/textures/steel-rough.webp',
  steelHeight: '/textures/steel-height.webp',
  leatherColour: '/textures/leather-colour.webp',
  leatherRough: '/textures/leather-rough.webp',
  leatherHeight: '/textures/leather-height.webp',
  cordColour: '/textures/cord-colour.webp',
  cordRough: '/textures/cord-rough.webp',
  cordHeight: '/textures/cord-height.webp',
  weaveColour: '/textures/weave-colour.webp',
  weaveRough: '/textures/weave-rough.webp',
  weaveHeight: '/textures/weave-height.webp',
  walnutColour: '/textures/walnut-colour.webp',
  walnutRough: '/textures/walnut-rough.webp',
} as const
export type SwordTextureKey = keyof typeof SWORD_TEXTURES
export type SwordTextures = Record<SwordTextureKey, THREE.Texture>

/** Raw (0-1) mean of each data map; colour maps give their linear mean. */
export const SCAN_MEANS = {
  steelRough: 0.4704,
  steelHeight: 0.5789,
  leatherRough: 0.4617,
  leatherHeight: 0.4944,
  cordRough: 0.6519,
  cordHeight: 0.5848,
  weaveRough: 0.61,
  weaveHeight: 0.376,
  leatherColour: [0.2202, 0.0778, 0.0114] as LinearRgb,
  cordColour: [0.2016, 0.1505, 0.0798] as LinearRgb,
  weaveColour: [0.1681, 0.1681, 0.1841] as LinearRgb,
}

const isColour = (key: string) => key.endsWith('Colour')

/** Wrap, anisotropy and colour space, set as the maps load: three never re-reads them after upload. */
export function prepareSwordTextures(textures: SwordTextures) {
  for (const [key, t] of Object.entries(textures)) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    t.colorSpace = isColour(key) ? THREE.SRGBColorSpace : THREE.NoColorSpace
    if (key.startsWith('walnut')) {
      t.center.set(0.5, 0.5)
      t.rotation = Math.PI / 2
    }
  }
}

// Highlights roll off softly into the cap rather than flattening at it, so they keep a gradient.
const capLine = `{
        float peak = max(max(outgoingLight.r, outgoingLight.g), max(outgoingLight.b, 1e-4));
        float knee = 0.6 * uCap;
        float rolled = peak <= knee ? peak : knee + (uCap - knee) * (1.0 - exp(-(peak - knee) / (uCap - knee)));
        outgoingLight *= rolled / peak;
      }
      #include <opaque_fragment>`

const helpers = `
      float sHash(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float sNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x),
          mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // Tilts the normal by a height field's slope (mm per mm), from screen-space steps in mm.
      vec3 slopeNormal(vec3 n, vec2 mm, float h0, float hx, float hy, float faceDir) {
        vec2 sx = dFdx(mm);
        vec2 sy = dFdy(mm);
        vec3 px = dFdx(-vViewPosition);
        vec3 py = dFdy(-vViewPosition);
        float gx = clamp((hx - h0) / max(length(sx), 1e-4), -2.0, 2.0);
        float gy = clamp((hy - h0) / max(length(sy), 1e-4), -2.0, 2.0);
        vec3 r1 = cross(normalize(py), n);
        vec3 r2 = cross(n, normalize(px));
        float det = dot(normalize(px), r1) * faceDir;
        vec3 grad = sign(det) * (gx * r1 + gy * r2);
        return normalize(abs(det) * n - grad);
      }`

const vertexAttrs =
  (attrs: string[], uvVarying: string) => (shader: THREE.WebGLProgramParametersWithUniforms) => {
    const decl = attrs
      .map((a) => `attribute float ${a};\n      varying float v${a.slice(1)};`)
      .join('\n      ')
    const copy = attrs.map((a) => `v${a.slice(1)} = ${a};`).join('\n      ')
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n      ${decl}\n      varying vec2 ${uvVarying};`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n      ${copy}\n      ${uvVarying} = uv;`,
      )
  }

const varyings = (attrs: string[], uvVarying: string) =>
  attrs.map((a) => `varying float v${a.slice(1)};`).join('\n      ') +
  `\n      varying vec2 ${uvVarying};`

// ---------------------------------------------------------------- blade

export function bladeUniforms(textures: SwordTextures) {
  return {
    uCap: { value: REST_CAP },
    uSteelRough: { value: textures.steelRough },
    uSteelHeight: { value: textures.steelHeight },
    uRoughMean: { value: SCAN_MEANS.steelRough },
    uHeightMean: { value: SCAN_MEANS.steelHeight },
    /** Brush tile along and across the blade, mm. */
    uTile: { value: new THREE.Vector2(140, 60) },
    uScratch: { value: 0.08 },
    uBrushDepth: { value: 0.006 },
    uHammer: { value: 0 },
    uGrind: { value: 0.1 },
    uBladeZ: { value: new THREE.Vector2(0, 1) },
    uFullerRough: { value: 0.2 },
    uFullerDark: { value: 0.28 },
    uBareEdge: { value: 0 },
    uEdgeColour: { value: new THREE.Color(...BARE_EDGE) },
    uPatternKind: { value: 0 },
    uPatternMix: { value: 0 },
    uPatternLight: { value: new THREE.Color() },
    uPatternDark: { value: new THREE.Color() },
    uPatternRough: { value: new THREE.Vector2() },
    uWear: { value: 0.3 },
    uRuneMap: { value: null as THREE.Texture | null },
    uRuneRect: { value: new THREE.Vector4(0, 1, 0, 1) },
    uRuneOn: { value: 0 },
    uRuneColour: { value: new THREE.Color() },
    uRuneGlow: { value: 0.9 },
    uEngraveMap: { value: null as THREE.Texture | null },
    uEngraveRect: { value: new THREE.Vector4(0, 1, 0, 1) },
    uEngraveOn: { value: 0 },
    uCutDepth: { value: 0.3 },
  }
}
export type BladeUniforms = ReturnType<typeof bladeUniforms>

const BLADE_ATTRS = ['aAlong', 'aEdge', 'aFuller', 'aShade', 'aFromEdge', 'aWidth']

function patchBlade(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: BladeUniforms) {
  Object.assign(shader.uniforms, uniforms)
  vertexAttrs(BLADE_ATTRS, 'vBladeMm')(shader)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uCap;
      uniform sampler2D uSteelRough;
      uniform sampler2D uSteelHeight;
      uniform float uRoughMean;
      uniform float uHeightMean;
      uniform vec2 uTile;
      uniform float uScratch;
      uniform float uBrushDepth;
      uniform float uHammer;
      uniform float uGrind;
      uniform vec2 uBladeZ;
      uniform float uFullerRough;
      uniform float uFullerDark;
      uniform float uBareEdge;
      uniform vec3 uEdgeColour;
      uniform float uPatternKind;
      uniform float uPatternMix;
      uniform vec3 uPatternLight;
      uniform vec3 uPatternDark;
      uniform vec2 uPatternRough;
      uniform float uWear;
      uniform sampler2D uRuneMap;
      uniform vec4 uRuneRect;
      uniform float uRuneOn;
      uniform vec3 uRuneColour;
      uniform float uRuneGlow;
      uniform sampler2D uEngraveMap;
      uniform vec4 uEngraveRect;
      uniform float uEngraveOn;
      uniform float uCutDepth;
      ${varyings(BLADE_ATTRS, 'vBladeMm')}
      ${helpers}
      // Brushed along the blade: the scan's streaks run across the image, so its axes swap.
      vec2 brushUv(vec2 mm) { return vec2(mm.y / uTile.x, mm.x / uTile.y); }
      float zOf(float along) { return uBladeZ.x + along * uBladeZ.y; }
      float maskAt(sampler2D map, vec4 rect, float on, vec2 mm, float along) {
        if (on < 0.5) return 0.0;
        vec2 st = vec2((zOf(along) - rect.x) / (rect.y - rect.x), (mm.x - rect.z) / (rect.w - rect.z));
        if (st.x < 0.0 || st.x > 1.0 || st.y < 0.0 || st.y > 1.0) return 0.0;
        return texture2D(map, st).r;
      }
      float runeAt(vec2 mm, float along) { return maskAt(uRuneMap, uRuneRect, uRuneOn, mm, along); }
      float engraveAt(vec2 mm, float along) { return maskAt(uEngraveMap, uEngraveRect, uEngraveOn, mm, along); }
      float cutAt(vec2 mm, float along) { return max(runeAt(mm, along), engraveAt(mm, along)); }
      // Ripples: broad flowing bands, mostly along the blade, in mm; finer than a pixel they fade to grey.
      float watered(vec2 mm) {
        vec2 p = mm * vec2(0.06, 0.02);
        float warp = 1.2 * sNoise(p) + 0.5 * sNoise(p * 3.1 + 7.3);
        float arg = mm.x * 0.9 + warp * 16.0 + 1.5 * sin(mm.y * 0.12 + mm.x * 0.3);
        float aa = 1.0 - smoothstep(0.15, 0.45, fwidth(arg) / 6.2832);
        return mix(0.5, smoothstep(-0.8, 0.8, sin(arg) + 0.3 * sin(arg * 2.3 + 0.7)), aa);
      }
      // The temper line: hardened steel along the edge, its boundary a slow soft wave.
      float hardened(vec2 mm) {
        float line = vWidth * (0.3 + 0.05 * sin(mm.y * 0.16) + 0.04 * sin(mm.y * 0.051 + 1.3) + 0.08 * (sNoise(vec2(mm.y * 0.08, 1.7)) - 0.5));
        return 1.0 - smoothstep(line - 2.2, line + 2.2, vFromEdge);
      }
      float patternAt(vec2 mm) {
        if (uPatternKind > 1.5) return hardened(mm);
        if (uPatternKind > 0.5) return watered(mm);
        return 0.0;
      }
      // Hammer dishes of varied size meeting at ridges: 1 at a dish's floor, 0 on the ridges.
      // Pattern-welded steel is ground and etched after forging, so it carries none.
      float hammer(vec2 mm) {
        if (uHammer <= 0.0 || uPatternMix > 0.5) return 0.0;
        vec2 p = mm / 6.0;
        vec2 cell = floor(p);
        float best = 1.0;
        for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 c = cell + vec2(float(i), float(j));
            vec2 at = c + 0.15 + 0.7 * vec2(sHash(c + 3.1), sHash(c + 9.7));
            best = min(best, length(p - at) / (0.8 + 0.4 * sHash(c + 5.3)));
          }
        // The edge bevel and the fullers are ground after forging, so they keep no dishes.
        float ground = (1.0 - clamp(vEdge, 0.0, 1.0)) * (1.0 - clamp(vFuller, 0.0, 1.0));
        return pow(1.0 - smoothstep(0.0, 1.15, best), 2.0) * ground;
      }
      float steelHeightAt(vec2 mm, float along) {
        float brush = (texture2D(uSteelHeight, brushUv(mm)).r - uHeightMean) * uBrushDepth;
        // Nie: sparse bright crystals in the hardened edge, as tiny pits that catch the light.
        float nie = uPatternKind > 1.5 ? step(0.985, sHash(floor(mm * 3.0))) * hardened(mm) * 0.004 : 0.0;
        return brush - nie - uHammer * hammer(mm) - uCutDepth * cutAt(mm, along);
      }`,
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      vec2 mm = vBladeMm;
      float pattern = patternAt(mm);
      // The pattern's bands take the steel's own lightness, so dark steel makes a dark pattern.
      float steelLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.59;
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(uPatternDark, uPatternLight, pattern) * steelLum, uPatternMix);
      float dish = hammer(mm);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.9, 0.88, 0.86), dish);
      float fuller = clamp(vFuller, 0.0, 1.0);
      float edge = clamp(vEdge, 0.0, 1.0) * uBareEdge;
      // A thin dark lip where the groove's wall turns, so it reads as cut.
      float lip = smoothstep(0.0, 0.25, fuller) * (1.0 - smoothstep(0.35, 0.8, fuller));
      diffuseColor.rgb *= (1.0 - uFullerDark * fuller - 0.3 * lip) * clamp(vShade, 0.0, 1.0);
      // Patina where hands and fittings meet, and oxide speckles as it wears.
      float base = 1.0 - smoothstep(0.0, 45.0, vAlong * uBladeZ.y);
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.82, 0.78, 0.7), 0.55 * uWear * base);
      float speck = smoothstep(0.86, 0.92, sNoise(vec2(mm.x * 1.7, mm.y * 0.25))) * smoothstep(0.5, 1.0, uWear)
        * (0.4 + 0.6 * smoothstep(0.6, 1.0, clamp(vEdge, 0.0, 1.0)));
      diffuseColor.rgb *= (1.0 - 0.3 * speck) * (1.0 - 0.12 * uWear);
      diffuseColor.rgb = mix(diffuseColor.rgb, uEdgeColour, edge);
      float cut = cutAt(mm, vAlong);
      diffuseColor.rgb *= 1.0 - 0.45 * cut;
      // Grind streaks along the blade, and slow polish zones down its length, both in mm:
      // they vary how much the steel reflects as well as how sharply.
      vec2 coarse = vec2(mm.x * 2.2, mm.y * 0.012);
      vec2 fine = vec2(mm.x * 8.0, mm.y * 0.03);
      float streak = (sNoise(coarse) - 0.5) * (1.0 - smoothstep(0.5, 1.5, fwidth(coarse.x)))
        + 0.6 * (sNoise(fine) - 0.5) * (1.0 - smoothstep(0.5, 1.5, fwidth(fine.x)));
      float zone = sNoise(vec2(1.3, mm.y * 0.006)) - 0.5;
      diffuseColor.rgb *= 1.0 + uGrind * (1.3 * streak + 1.2 * zone);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float scan = texture2D(uSteelRough, brushUv(mm)).r / uRoughMean - 1.0;
      float scratches = (smoothstep(0.75, 0.95, sNoise(vec2(mm.x * 3.0, mm.y * 0.06)))
        + 0.7 * smoothstep(0.8, 0.95, sNoise(vec2(mm.x * 7.0, mm.y * 0.09) + 4.1))) * max(uWear, 0.4);
      roughnessFactor = mix(roughnessFactor, mix(uPatternRough.y, uPatternRough.x, pattern), uPatternMix);
      // Polished steel ignores the brushed scan.
      roughnessFactor += uScratch * scan * smoothstep(0.1, 0.3, roughnessFactor) + 0.12 * scratches + uFullerRough * fuller + 0.25 * cut;
      roughnessFactor += 0.05 * dish;
      roughnessFactor += uGrind * (0.9 * streak + 0.5 * zone);
      // Every cutting bevel is honed smoother than the flat, so the edge reads as a crisp line.
      roughnessFactor = mix(roughnessFactor, 0.7 * roughnessFactor, clamp(vEdge, 0.0, 1.0));
      roughnessFactor = mix(roughnessFactor, 0.2, edge);
      roughnessFactor = clamp(roughnessFactor, 0.04, 1.0);`,
    )
    .replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, 1.0, edge);`,
    )
    .replace(
      '#include <lights_physical_fragment>',
      `#include <lights_physical_fragment>
      #ifdef USE_IRIDESCENCE
        material.iridescence *= 1.0 - edge;
      #endif`,
    )
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      {
        vec2 dx = dFdx(vBladeMm);
        vec2 dy = dFdy(vBladeMm);
        float ax = dFdx(vAlong);
        float ay = dFdy(vAlong);
        float h0 = steelHeightAt(vBladeMm, vAlong);
        normal = slopeNormal(normal, vBladeMm, h0, steelHeightAt(vBladeMm + dx, vAlong + ax), steelHeightAt(vBladeMm + dy, vAlong + ay), faceDirection);
      }`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        float rune = runeAt(mm, vAlong);
        // A paler, hotter core inside the channel, the rune's own colour at its edges.
        vec3 hot = mix(uRuneColour, vec3(max(uRuneColour.r, max(uRuneColour.g, uRuneColour.b))), 0.45 * smoothstep(0.6, 1.0, rune));
        totalEmissiveRadiance += hot * uRuneGlow * rune;
      }`,
    )
    .replace('#include <opaque_fragment>', capLine)
}

export function bladeMaterial(steel: SteelRow, uniforms: BladeUniforms) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(...steel.colour),
    metalness: steel.metalness,
    roughness: steel.roughness,
    anisotropy: Math.max(0.05, steel.anisotropy),
    anisotropyRotation: Math.PI / 2,
    envMapIntensity: steel.envIntensity,
    iridescence: steel.iridescence,
    iridescenceIOR: 1.8,
    iridescenceThicknessRange: BLUING_FILM,
  })
  material.onBeforeCompile = (shader) => patchBlade(shader, uniforms)
  return material
}

// ---------------------------------------------------------------- fittings

export function fittingsUniforms(textures: SwordTextures) {
  return {
    uCap: { value: REST_CAP },
    uSteelRough: { value: textures.steelRough },
    uRoughMean: { value: SCAN_MEANS.steelRough },
    uTileMm: { value: 45 },
    uWear: { value: 0.3 },
  }
}
export type FittingsUniforms = ReturnType<typeof fittingsUniforms>

function patchFittings(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: FittingsUniforms,
) {
  Object.assign(shader.uniforms, uniforms)
  vertexAttrs(['aShade'], 'vPartMm')(shader)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uCap;
      uniform sampler2D uSteelRough;
      uniform float uRoughMean;
      uniform float uTileMm;
      uniform float uWear;
      ${varyings(['aShade'], 'vPartMm')}`,
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float crease = 1.0 - clamp(vShade, 0.0, 1.0);
      // Tarnish gathers in the creases: darker and a little warmer.
      diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.5, 0.44), clamp(crease * (1.2 + uWear), 0.0, 1.0));
      diffuseColor.rgb *= mix(1.0, 0.6, uWear * crease);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float scan = texture2D(uSteelRough, vPartMm / uTileMm).r / uRoughMean - 1.0;
      roughnessFactor = clamp(roughnessFactor + (0.05 + 0.06 * uWear) * scan + 0.3 * crease, 0.05, 1.0);`,
    )
    .replace('#include <opaque_fragment>', capLine)
}

export function fittingsMaterial(
  row: FittingsRow,
  uniforms: FittingsUniforms,
  roughness = row.roughness,
) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(...row.colour),
    metalness: row.metalness,
    roughness,
    envMapIntensity: row.iridescence ? 1.25 : 1.2,
    iridescence: row.iridescence ?? 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [200, 400],
  })
  material.onBeforeCompile = (shader) => patchFittings(shader, uniforms)
  return material
}

// ---------------------------------------------------------------- leather, cord, diamond wrap

export type Textile = 'leather' | 'cord' | 'weave'

export const TEXTILES: Record<
  Textile,
  { roughness: number; sheen: number; heightMm: number; tile: [around: number, along: number] }
> = {
  leather: { roughness: 0.6, sheen: 0.1, heightMm: 0.25, tile: [0, 90] },
  cord: { roughness: 0.75, sheen: 0.2, heightMm: 0.3, tile: [22, 22] },
  weave: { roughness: 0.6, sheen: 0.5, heightMm: 0.45, tile: [18, 18] },
}

export function textileUniforms(textures: SwordTextures, textile: Textile) {
  return {
    uCap: { value: REST_CAP },
    uScan: { value: textures[`${textile}Colour`] },
    uScanRough: { value: textures[`${textile}Rough`] },
    uScanHeight: { value: textures[`${textile}Height`] },
    uScanMean: { value: new THREE.Vector3(...SCAN_MEANS[`${textile}Colour`]) },
    uRoughMean: { value: SCAN_MEANS[`${textile}Rough`] },
    uHeightMean: { value: SCAN_MEANS[`${textile}Height`] },
    uHeightMm: { value: TEXTILES[textile].heightMm },
    /** Tile around and along the grip, mm. */
    uTile: { value: new THREE.Vector2(...TEXTILES[textile].tile) },
    uBase: { value: new THREE.Vector3(...LEATHER_BASE) },
    uAbsorb: { value: new THREE.Vector3() },
    /** Extra dye for a braid, which takes it deeper than leather. */
    uDyeDepth: { value: textile === 'weave' ? 1.6 : 1 },
    uWear: { value: 0.3 },
    /** The grip's length, mm, so wear can find where the hand sits. */
    uGripLength: { value: 100 },
    uRayskin: { value: new THREE.Vector3(...RAYSKIN) },
  }
}
export type TextileUniforms = ReturnType<typeof textileUniforms>

function patchTextile(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: TextileUniforms) {
  Object.assign(shader.uniforms, uniforms)
  vertexAttrs(['aWrap', 'aShade'], 'vGripMm')(shader)
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform float uCap;
      uniform sampler2D uScan;
      uniform sampler2D uScanRough;
      uniform sampler2D uScanHeight;
      uniform vec3 uScanMean;
      uniform float uRoughMean;
      uniform float uHeightMean;
      uniform float uHeightMm;
      uniform vec2 uTile;
      uniform vec3 uBase;
      uniform vec3 uAbsorb;
      uniform float uDyeDepth;
      uniform float uWear;
      uniform float uGripLength;
      uniform vec3 uRayskin;
      ${varyings(['aWrap', 'aShade'], 'vGripMm')}
      ${helpers}
      vec2 scanUv(vec2 mm) { return mm / uTile; }
      // Rayskin: small rounded nodules packed close, about a millimetre across.
      float nodules(vec2 mm) {
        vec2 p = mm * 1.1;
        vec2 cell = floor(p);
        float best = 1.0;
        for (int j = -1; j <= 1; j++)
          for (int i = -1; i <= 1; i++) {
            vec2 c = cell + vec2(float(i), float(j));
            vec2 at = c + 0.2 + 0.6 * vec2(sHash(c), sHash(c + 17.1));
            best = min(best, length(p - at));
          }
        return 1.0 - smoothstep(0.15, 0.62, best);
      }
      float textileHeight(vec2 mm, float wrap) {
        float scan = (texture2D(uScanHeight, scanUv(mm)).r - uHeightMean) * uHeightMm;
        return mix(0.25 * nodules(mm), scan, wrap);
      }`,
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float wrap = clamp(vWrap, 0.0, 1.0);
      vec3 texel = texture2D(uScan, scanUv(vGripMm)).rgb;
      float lum = dot(texel, vec3(0.2126, 0.7152, 0.0722));
      float lumMean = dot(uScanMean, vec3(0.2126, 0.7152, 0.0722));
      vec3 detail = mix(vec3(lum / lumMean), texel / uScanMean, 0.3);
      // Dye soaks deeper into the darker creases of the scan.
      float soak = clamp(1.0 + 0.6 * (1.0 - lum / lumMean), 0.6, 1.8);
      vec3 dyed = uBase * clamp(detail, 0.2, 2.5) * exp(-uAbsorb * soak * uDyeDepth);
      // Where the hand sits, a well-loved grip darkens and polishes.
      float held = uWear * smoothstep(0.15, 0.3, vGripMm.y / uGripLength) * (1.0 - smoothstep(0.7, 0.85, vGripMm.y / uGripLength));
      dyed *= 1.0 - 0.25 * held;
      vec3 skin = uRayskin * mix(0.78, 1.04, nodules(vGripMm));
      diffuseColor.rgb = mix(skin, dyed, wrap) * clamp(vShade, 0.0, 1.0);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      float r = texture2D(uScanRough, scanUv(vGripMm)).r / uRoughMean - 1.0;
      roughnessFactor = clamp(mix(0.5, roughnessFactor + 0.25 * r - 0.15 * held, wrap), 0.2, 1.0);`,
    )
    .replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
      {
        vec2 dx = dFdx(vGripMm);
        vec2 dy = dFdy(vGripMm);
        float h0 = textileHeight(vGripMm, wrap);
        normal = slopeNormal(normal, vGripMm, h0, textileHeight(vGripMm + dx, wrap), textileHeight(vGripMm + dy, wrap), faceDirection);
      }`,
    )
    .replace('#include <opaque_fragment>', capLine)
}

export function textileMaterial(textile: Textile, uniforms: TextileUniforms) {
  const t = TEXTILES[textile]
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: t.roughness,
    sheen: t.sheen,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(1, 0.95, 0.88),
    envMapIntensity: 0.9,
  })
  material.onBeforeCompile = (shader) => patchTextile(shader, uniforms)
  return material
}

// ---------------------------------------------------------------- bone ribs

export function boneMaterial(cap: THREE.IUniform<number>) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(...BONE),
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.5,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uCap = cap
    vertexAttrs(['aShade'], 'vBoneMm')(shader)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      uniform float uCap;
      ${varyings(['aShade'], 'vBoneMm')}
      ${helpers}`,
      )
      .replace(
        '#include <map_fragment>',
        // Bone: a warm and cool mottle, fine pores, and darker grooves where hands have been.
        `#include <map_fragment>
      float mottle = sNoise(vBoneMm * 0.15) - 0.5;
      float pore = smoothstep(0.85, 0.95, sNoise(vBoneMm * 2.5)) * (1.0 - smoothstep(0.3, 1.0, fwidth(vBoneMm.x * 2.5)));
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9, 0.82, 0.68), 0.5 + mottle) * (1.0 + 0.12 * mottle);
      diffuseColor.rgb *= (1.0 - 0.15 * pore) * mix(0.88, 1.0, clamp(vShade, 0.0, 1.0)) * clamp(vShade, 0.0, 1.0);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
      roughnessFactor = clamp(roughnessFactor + 0.15 * pore, 0.0, 1.0);`,
      )
      .replace('#include <opaque_fragment>', capLine)
  }
  return material
}

/** Plain mid-grey for judging form alone (the dev-only `?clay` switch). */
export function clayMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9a9a9a,
    roughness: 0.55,
    metalness: 0,
    envMapIntensity: 0.6,
  })
}
