// The potion's look (ADR 0109): fake glass in two passes either side of the liquid, the layered
// liquid cut at a level plane, the stoppers, and the label's paper and ink. Pure tables first,
// then the material builders, whose uniforms are written through the material, never props.

import * as THREE from 'three'

import { srgbToLinear } from '../items/colour.ts'
import type { Trait } from '../potion/ingredients.ts'
import {
  type GlassId,
  GLASS_TINTS,
  type LabelId,
  MAX_POURS,
  type StopperId,
} from '../potion/potionSchema.ts'
import type { MeshPart } from '../sword/sweep.ts'
import { BLOOM_THRESHOLD } from './stage.ts'

export const REST_CAP = 0.92 * BLOOM_THRESHOLD

/** The sword's soft knee: from 0.6 of the cap the brightest channel rolls off towards it. */
export function softCap(v: number, cap = REST_CAP): number {
  const knee = 0.6 * cap
  if (v <= knee) return v
  const room = cap - knee
  return knee + room * (1 - Math.exp(-(v - knee) / room)) * 0.999
}

const SOFT_CAP_GLSL = /* glsl */ `
vec3 potionCap(vec3 c, float cap) {
  float m = max(max(c.r, c.g), c.b);
  float knee = 0.6 * cap;
  if (m <= knee) return c;
  float room = cap - knee;
  return c * ((knee + room * (1.0 - exp(-(m - knee) / room)) * 0.999) / m);
}
`

const NOISE_GLSL = /* glsl */ `
vec3 potionMod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 potionMod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 potionPermute(vec4 x) { return potionMod289(((x * 34.0) + 10.0) * x); }
float potionNoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = potionMod289(i);
  vec4 p = potionPermute(potionPermute(potionPermute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y +
    vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  vec3 ns = 0.142857142857 * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 *
    vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float potionFbm(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * potionNoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amp *= 0.5;
  }
  return sum;
}
`

type Rgb = readonly [number, number, number]

const linear = (hex: string): Rgb => srgbToLinear(hex)
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb =>
  [0, 1, 2].map((i) => a[i]! + (b[i]! - a[i]!) * t) as unknown as Rgb
const scaleRgb = (a: Rgb, k: number): Rgb => a.map((v) => v * k) as unknown as Rgb

// ---- Glass -----------------------------------------------------------------------------------

export interface GlassLook {
  /** What the glass lets through face on and edge on: linear multipliers of what is behind it. */
  through: Rgb
  edge: Rgb
  edgePow: number
  /** How much it hides of what is behind it, face on and edge on. */
  alpha: number
  edgeAlpha: number
  /** The glass's own colour where it is seen edge on, over the dark room. */
  body: Rgb
  /** The fresnel rim, times its intensity. */
  rim: Rgb
  rimPow: number
  roughness: number
  env: number
}

/** G1, thin clear glass, as Ed picked it. */
const G1: GlassLook = {
  through: [0.97, 0.98, 0.98],
  edge: [0.62, 0.68, 0.7],
  edgePow: 2.4,
  alpha: 0.015,
  edgeAlpha: 0.22,
  body: [0, 0, 0],
  rim: scaleRgb(linear('#dfe8ff'), 0.3),
  rimPow: 4.5,
  roughness: 0.03,
  env: 1.5,
}

/** A tinted G1: what it lets through leans to the tint by `strength`; its edge and rim take its colour. */
function tinted(hex: string, strength: number, body: number): GlassLook {
  const tint = linear(hex)
  const peak = Math.max(...tint)
  const unit = scaleRgb(tint, 1 / peak)
  const through = mixRgb([1, 1, 1], unit, strength)
  return {
    ...G1,
    through: scaleRgb(through, 0.96),
    edge: scaleRgb(mixRgb(G1.edge, unit, 0.75), 0.75),
    alpha: 0.03,
    edgeAlpha: 0.32,
    body: scaleRgb(unit, body),
    rim: scaleRgb(mixRgb(linear('#dfe8ff'), unit, 0.55), 0.3),
  }
}

export const GLASS_LOOKS: Record<GlassId, GlassLook> = {
  clear: G1,
  sea: tinted(GLASS_TINTS.sea, 0.42, 0.1),
  amber: tinted(GLASS_TINTS.amber, 0.45, 0.12),
  violet: tinted(GLASS_TINTS.violet, 0.4, 0.12),
  smoky: { ...tinted(GLASS_TINTS.smoky, 0.3, 0.05), through: [0.62, 0.61, 0.63] },
}

/** The glass stopper: the same glass, solid, so it hides more and carries more light. */
export const STOPPER_GLASS = (look: GlassLook): GlassLook => ({
  ...look,
  alpha: look.alpha + 0.05,
  edgeAlpha: Math.min(0.6, look.edgeAlpha + 0.2),
  rim: scaleRgb(look.rim, 1.4),
})

/** Back the far wall's light off, so the candle shows once in the near wall, not again inside the far one. */
const FAR_LIGHT = 0.15
/** The cavity's own surface reflects less than the outside. */
const INNER_LIGHT = 0.06

const GLASS_PARS = /* glsl */ `
uniform vec3 uEye, uCentre;
varying vec3 vBottle;
varying vec3 vBottleNormal;
bool potionWrongSide() {
  float near = dot(vBottle - uCentre, uEye - vBottle);
  return NEAR_PASS ? near < 0.0 : near >= 0.0;
}
float potionInner() {
  float r = length(vBottle.xy);
  return r < 1e-3 ? 0.0 : step(dot(vBottleNormal.xy, vBottle.xy), -0.02 * r);
}
`

const GLASS_TINT_VERTEX = /* glsl */ `
varying vec3 vBottle;
varying vec3 vBottleNormal;
varying vec3 vN;
varying vec3 vV;
void main() {
  vBottle = position;
  vBottleNormal = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = -mv.xyz;
  vN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}
`

const GLASS_TINT_FRAGMENT = /* glsl */ `
uniform vec3 uThrough;
uniform vec3 uEdgeTint;
uniform float uEdgePow;
varying vec3 vN;
varying vec3 vV;
${GLASS_PARS}
void main() {
  if (potionWrongSide()) discard;
  float inner = potionInner();
  float ndv = abs(dot(normalize(vN), normalize(vV)));
  vec3 through = mix(uThrough, uEdgeTint, pow(1.0 - ndv, uEdgePow));
  float reflected = 0.04 + 0.96 * pow(1.0 - ndv, 5.0);
  vec3 outer = through * (1.0 - reflected);
  gl_FragColor = vec4(mix(outer, vec3(1.0 - 0.5 * reflected), inner), 1.0);
}
`

export interface GlassShared {
  [name: string]: THREE.IUniform
  /** The eye in the bottle's own millimetre frame. */
  uEye: THREE.IUniform<THREE.Vector3>
  /** The middle of what the glass holds: what lies past it from the eye is the far wall. */
  uCentre: THREE.IUniform<THREE.Vector3>
}

export const glassShared = (): GlassShared => ({
  uEye: { value: new THREE.Vector3(0, -1e4, 0) },
  uCentre: { value: new THREE.Vector3() },
})

/** What the glass lets through: multiplies whatever is already drawn behind it. */
function glassTint(look: GlassLook, near: boolean, shared: GlassShared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uThrough: { value: new THREE.Vector3(...look.through) },
      uEdgeTint: { value: new THREE.Vector3(...look.edge) },
      uEdgePow: { value: look.edgePow },
    },
    defines: { NEAR_PASS: near ? 'true' : 'false' },
    vertexShader: GLASS_TINT_VERTEX,
    fragmentShader: GLASS_TINT_FRAGMENT,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.ZeroFactor,
    blendDst: THREE.SrcColorFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  })
}

/** What the glass reflects and the light in its edges, drawn premultiplied over what is behind. */
function glassLight(
  look: GlassLook,
  near: boolean,
  shared: GlassShared,
): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: look.roughness,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: look.roughness * 0.7,
    envMapIntensity: look.env,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
  material.defines = { NEAR_PASS: near ? 'true' : 'false' }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, {
      uCap: { value: REST_CAP },
      uRim: { value: new THREE.Vector3(...look.rim) },
      uRimPow: { value: look.rimPow },
      uAlpha: { value: look.alpha },
      uEdgeAlpha: { value: look.edgeAlpha },
      uEdgePow: { value: look.edgePow },
      uBody: { value: new THREE.Vector3(...look.body) },
      uPassLight: { value: near ? 1 : FAR_LIGHT },
    })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vBottle;\nvarying vec3 vBottleNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBottle = position;\nvBottleNormal = normal;',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uCap, uRimPow, uAlpha, uEdgeAlpha, uEdgePow, uPassLight;
uniform vec3 uRim, uBody;
${GLASS_PARS}
${SOFT_CAP_GLSL}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nif (potionWrongSide()) discard;',
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float glassNdv = abs(dot(normal, normalize(vViewPosition)));
float glassEdge = pow(1.0 - glassNdv, uEdgePow);
float glassInner = potionInner();
totalEmissiveRadiance += uRim * pow(1.0 - glassNdv, uRimPow) * (1.0 - 0.7 * glassInner);`,
      )
      .replace(
        '#include <lights_fragment_end>',
        // The lamps' own glints would show the candle twice: the environment's flame is the one reflection.
        `#include <lights_fragment_end>
reflectedLight.directSpecular = vec3(0.0);
#ifdef USE_CLEARCOAT
clearcoatSpecularDirect = vec3(0.0);
#endif`,
      )
      .replace(
        '#include <opaque_fragment>',
        `float glassA = mix(uAlpha, uEdgeAlpha, glassEdge) * (1.0 - 0.6 * glassInner);
vec3 glassCol = max(outgoingLight - totalDiffuse, 0.0) * uPassLight * mix(1.0, ${INNER_LIGHT.toFixed(2)}, glassInner);
glassCol += uBody * glassA;
gl_FragColor = vec4(potionCap(glassCol, uCap), glassA);`,
      )
  }
  return material
}

export interface GlassPasses {
  farTint: THREE.Material
  farLight: THREE.Material
  nearTint: THREE.Material
  nearLight: THREE.Material
  dispose(): void
}

export function createGlass(look: GlassLook, shared: GlassShared): GlassPasses {
  const passes = {
    farTint: glassTint(look, false, shared),
    farLight: glassLight(look, false, shared),
    nearTint: glassTint(look, true, shared),
    nearLight: glassLight(look, true, shared),
  }
  return { ...passes, dispose: () => Object.values(passes).forEach((m) => m.dispose()) }
}

// ---- Liquid ----------------------------------------------------------------------------------

/** L2: each boundary blends over this share of its thinner neighbour, within these bounds in mm. */
const BAND_EDGE = 0.08
const BAND_EDGE_MM: [number, number] = [0.4, 4]

/** The soft half width of each boundary between bands, for tops `levels` over a floor at `floor`. */
export function bandEdges(levels: readonly number[], floor: number): number[] {
  const bottoms = [floor, ...levels]
  return levels.slice(0, -1).map((top, i) => {
    const below = top - bottoms[i]!
    const above = levels[i + 1]! - top
    const e = BAND_EDGE * Math.min(below, above)
    return Math.min(
      BAND_EDGE_MM[1],
      Math.max(Math.min(BAND_EDGE_MM[0], 0.45 * Math.min(below, above)), e),
    )
  })
}

/** The liquid's look: L2's numbers from the spike, the cloud and the light through it. */
export const LIQUID = {
  depth: 1.45,
  self: 0.12,
  diffuse: 0.5,
  /** The candle's light out of the far side of the liquid. */
  thru: 0.6,
  saturation: 1,
  /** The cool light from behind, through the liquid. */
  back: 0.55,
  milkSheen: 0.16,
}

const isCloud = (trait: Trait) => trait === 'cloud' || trait === 'murk'

const LIQUID_PARS = /* glsl */ `
uniform vec3 uUp, uEye;
uniform float uLevels[${MAX_POURS}];
uniform float uEdges[${MAX_POURS - 1}];
uniform int uCount;
uniform vec3 uColour[${MAX_POURS}];
uniform float uCloud[${MAX_POURS}];
uniform float uTime, uFloor, uDepth, uSelf, uDiffuse, uThru, uCap, uMilkSheen;
uniform vec3 uKeyDir, uKeyColour, uBackDir, uBackColour;
varying vec3 vBottle;
varying vec3 vUpView;
${SOFT_CAP_GLSL}
${NOISE_GLSL}
// The bands' colour at height h along the surface's up: one function of h, so a mix can blend it later.
vec3 potionBand(float h, out float cloud) {
  vec3 c = uColour[0];
  cloud = uCloud[0];
  for (int i = 0; i < ${MAX_POURS - 1}; i++) {
    if (i >= uCount - 1) break;
    float s = smoothstep(uLevels[i] - uEdges[i], uLevels[i] + uEdges[i], h);
    c = mix(c, uColour[i + 1], s);
    cloud = mix(cloud, uCloud[i + 1], s);
  }
  return c;
}
vec3 potionBase(vec3 c, float cloud, vec3 p) {
  if (cloud < 0.01) return c;
  float n = potionFbm(p * 0.03 + vec3(0.0, uTime * 0.05, 0.0));
  float wisp = potionFbm(p * vec3(0.05, 0.05, 0.12) + vec3(uTime * 0.03, 0.0, 0.0));
  return mix(c, c * (0.8 + 0.2 * n + 0.12 * smoothstep(0.0, 0.5, wisp)), cloud);
}
`

const LIQUID_MAIN = /* glsl */ `
if (uCount == 0) discard;
float liqTop = uLevels[uCount - 1];
float liqH = dot(vBottle, uUp);
float liqCut = clamp((liqTop - liqH) / max(fwidth(liqH), 1e-4) + 0.5, 0.0, 1.0);
if (liqCut <= 0.0) discard;
vec3 liqRay = normalize(vBottle - uEye);
vec3 liqP = vBottle;
float liqEyeH = dot(uEye, uUp);
bool liqSurface = !gl_FrontFacing && liqEyeH > liqTop;
if (liqSurface) {
  float along = dot(liqRay, uUp);
  liqP = uEye + liqRay * ((liqTop - liqEyeH) / min(along, -1e-3));
  liqH = liqTop - 1e-3;
}
float liqCloud;
vec3 liqAlbedo = potionBase(potionBand(liqH, liqCloud), liqCloud, liqP);
float liqDown = clamp((liqH - uFloor) / max(liqTop - uFloor, 1e-3), 0.0, 1.0);
liqAlbedo *= mix(0.8, 1.04, liqDown) * (1.0 + 0.05 * potionNoise(liqP * 0.02 + vec3(0.0, uTime * 0.03, 0.0)));
`

const LIQUID_LIGHT = /* glsl */ `
float liqNdv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
float liqThick = liqSurface ? 1.0 : liqNdv;
vec3 liqDeep = pow(max(liqAlbedo, 1e-4), vec3(mix(1.0, uDepth, liqThick * (1.0 - 0.75 * liqCloud))));
float liqUp = clamp((liqH - uFloor) / max(liqTop - uFloor, 1e-3), 0.0, 1.0);
float liqRim = liqSurface ? 0.7 : mix(mix(0.3, 1.0, sqrt(liqNdv)), 1.0, 0.5 * liqCloud);
reflectedLight.directDiffuse *= liqRim;
reflectedLight.indirectDiffuse *= liqRim;
vec3 liqGlow = liqDeep * liqRim * uSelf;
vec3 liqKeyView = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
float liqAway = liqSurface ? 0.0 : pow(clamp(dot(normal, -liqKeyView) * 0.7 + 0.3, 0.0, 1.0), 1.6);
liqGlow += liqDeep * uKeyColour * liqAway * uThru * liqRim * (1.0 - 0.45 * liqCloud);
vec3 liqBackView = normalize((viewMatrix * vec4(uBackDir, 0.0)).xyz);
float liqBehind = pow(clamp(dot(normalize(vViewPosition), liqBackView), 0.0, 1.0), 2.0);
liqGlow += uBackColour * liqDeep * liqBehind * liqRim * liqRim * (1.0 - 0.6 * liqCloud);
liqGlow += liqCloud * pow(1.0 - liqNdv, 2.0) * uMilkSheen * liqAlbedo * mix(vec3(0.95, 0.9, 1.0), vec3(1.0, 0.95, 0.9), liqUp);
`

export interface LiquidUniforms {
  [name: string]: THREE.IUniform
  uUp: THREE.IUniform<THREE.Vector3>
  uEye: THREE.IUniform<THREE.Vector3>
  uLevels: THREE.IUniform<number[]>
  uEdges: THREE.IUniform<number[]>
  uCount: THREE.IUniform<number>
  uColour: THREE.IUniform<THREE.Vector3[]>
  uCloud: THREE.IUniform<number[]>
  uTime: THREE.IUniform<number>
  uFloor: THREE.IUniform<number>
  uDepth: THREE.IUniform<number>
  uSelf: THREE.IUniform<number>
  uDiffuse: THREE.IUniform<number>
  uThru: THREE.IUniform<number>
  uMilkSheen: THREE.IUniform<number>
  uCap: THREE.IUniform<number>
  uKeyDir: THREE.IUniform<THREE.Vector3>
  uKeyColour: THREE.IUniform<THREE.Vector3>
  uBackDir: THREE.IUniform<THREE.Vector3>
  uBackColour: THREE.IUniform<THREE.Vector3>
}

function liquidUniforms(): LiquidUniforms {
  const v3 = () => new THREE.Vector3()
  return {
    uUp: { value: new THREE.Vector3(0, 0, 1) },
    uEye: { value: new THREE.Vector3(0, -1e4, 0) },
    uLevels: { value: new Array<number>(MAX_POURS).fill(0) },
    uEdges: { value: new Array<number>(MAX_POURS - 1).fill(0) },
    uCount: { value: 0 },
    uColour: { value: Array.from({ length: MAX_POURS }, v3) },
    uCloud: { value: new Array<number>(MAX_POURS).fill(0) },
    uTime: { value: 0 },
    uFloor: { value: 0 },
    uDepth: { value: LIQUID.depth },
    uSelf: { value: LIQUID.self },
    uDiffuse: { value: LIQUID.diffuse },
    uThru: { value: LIQUID.thru },
    uMilkSheen: { value: LIQUID.milkSheen },
    uCap: { value: REST_CAP },
    uKeyDir: { value: new THREE.Vector3(-0.9, 0.1, 0.4).normalize() },
    uKeyColour: { value: v3().set(1, 0.8, 0.55) },
    uBackDir: { value: new THREE.Vector3(-0.5, -0.4, 0.75).normalize() },
    uBackColour: { value: v3() },
  }
}

/** The liquid's skin: discards above the level, caps the cut with its back faces, colours by band. */
function liquidMaterial(uniforms: LiquidUniforms, surface: boolean): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: '#ffffff',
    roughness: surface ? 0.07 : 0.5,
    metalness: 0,
    specularIntensity: surface ? 0.4 : 0.12,
    envMapIntensity: surface ? 0.3 : 0.5,
    side: surface ? THREE.BackSide : THREE.FrontSide,
    transparent: true,
    depthWrite: false,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uUp;\nvarying vec3 vBottle;\nvarying vec3 vUpView;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBottle = position;\nvUpView = normalize(normalMatrix * uUp);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${LIQUID_PARS}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\n${LIQUID_MAIN}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb = liqAlbedo * uDiffuse * (liqSurface ? 0.4 : 1.0);
diffuseColor.a = liqCut;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nif (!gl_FrontFacing) normal = vUpView;',
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
reflectedLight.directSpecular = vec3(0.0);
${LIQUID_LIGHT}`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight += liqGlow;
outgoingLight = potionCap(outgoingLight, uCap);
#include <opaque_fragment>`,
      )
  }
  return material
}

export interface LayerLook {
  colour: string
  trait: Trait
}

export interface Liquid {
  uniforms: LiquidUniforms
  /** The level surface, drawn first: the far wall's back faces, lit as the plane they show through. */
  surface: THREE.MeshPhysicalMaterial
  body: THREE.MeshPhysicalMaterial
  /** The surface's up `u` in the bottle's millimetre frame and each band's top along it, bottom first. */
  setSurface(up: THREE.Vector3, levels: readonly number[]): void
  setLayers(layers: readonly LayerLook[]): void
  dispose(): void
}

/** An sRGB colour as linear, pushed further from its own grey by `saturation`. */
function liquidColour(hex: string, saturation: number, out: THREE.Vector3): THREE.Vector3 {
  const [r, g, b] = linear(hex)
  const grey = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const push = (v: number) => Math.min(1, Math.max(0, grey + (v - grey) * saturation))
  return out.set(push(r), push(g), push(b))
}

export function createLiquid(): Liquid {
  const uniforms = liquidUniforms()
  const surface = liquidMaterial(uniforms, true)
  const body = liquidMaterial(uniforms, false)
  return {
    uniforms,
    surface,
    body,
    setSurface(up, levels) {
      const count = Math.min(levels.length, MAX_POURS)
      uniforms.uUp.value.copy(up)
      uniforms.uCount.value = count
      for (let i = 0; i < count; i++) uniforms.uLevels.value[i] = levels[i]!
      const edges = bandEdges(levels.slice(0, count), uniforms.uFloor.value)
      for (let i = 0; i < MAX_POURS - 1; i++) uniforms.uEdges.value[i] = edges[i] ?? 0
    },
    setLayers(layers) {
      layers.slice(0, MAX_POURS).forEach((layer, i) => {
        liquidColour(layer.colour, LIQUID.saturation, uniforms.uColour.value[i]!)
        uniforms.uCloud.value[i] = isCloud(layer.trait) ? 1 : 0
      })
    },
    dispose() {
      surface.dispose()
      body.dispose()
    },
  }
}

// ---- Clock -----------------------------------------------------------------------------------

/** The liquid's clock: frame time, held still under reduced motion, or frozen at one moment for shots. */
export class LiquidClock {
  time: number
  private readonly still: boolean

  constructor({ frozenAt, still }: { frozenAt: number | null; still: boolean }) {
    this.time = frozenAt ?? 0
    this.still = still || frozenAt !== null
  }

  tick(delta: number): number {
    if (!this.still) this.time += delta
    return this.time
  }
}

/** `?freeze=<seconds>` on a dev server: the moment every gate frame is drawn at. */
export function freezeFrom(search: string, dev: boolean): number | null {
  if (!dev) return null
  const raw = new URLSearchParams(search).get('freeze')
  if (raw === null || raw.trim() === '') return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) ? seconds : null
}

/** A few percent of flicker on the candle; constant while the clock stands still. */
export const candleFlicker = (t: number) =>
  1 + 0.04 * Math.sin(t * 7.1) + 0.025 * Math.sin(t * 13.3 + 2)

// ---- Stoppers --------------------------------------------------------------------------------

export interface StopperLook {
  colour: Rgb | null
  roughness: number
  clearcoat: number
  /** A little light from inside: wax lets some through. */
  glow: number
}

export const STOPPER_LOOKS: Record<StopperId, StopperLook> = {
  cork: { colour: linear('#c9ac84'), roughness: 0.9, clearcoat: 0, glow: 0 },
  glass: { colour: null, roughness: 0.03, clearcoat: 1, glow: 0 },
  wax: { colour: null, roughness: 0.3, clearcoat: 0.7, glow: 0.06 },
}

/** A pressed cork's surface: speckled granules of light and dark. */
export function corkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#b09878'
  ctx.fillRect(0, 0, 512, 256)
  let seed = 3
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 2600; i++) {
    const shade = rand() < 0.55 ? 60 + rand() * 50 : 170 + rand() * 50
    ctx.fillStyle = `rgba(${shade + 20},${shade * 0.78},${shade * 0.52},${0.25 + rand() * 0.5})`
    ctx.beginPath()
    ctx.ellipse(
      rand() * 512,
      rand() * 256,
      0.6 + rand() * 3.2,
      0.5 + rand() * 1.6,
      rand() * 3,
      0,
      7,
    )
    ctx.fill()
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 1 / 24)
  texture.anisotropy = 4
  return texture
}

export interface StopperSplit {
  [name: string]: THREE.IUniform
  /** The bore's radius and the lip's height: the cork plug is what lies inside the bore, below the lip. */
  uBoreR: THREE.IUniform<number>
  uLipZ: THREE.IUniform<number>
}

const SPLIT_PARS = /* glsl */ `
uniform float uBoreR, uLipZ;
varying vec3 vBottle;
bool potionIsCork() { return length(vBottle.xy) < uBoreR + 0.3 && vBottle.z < uLipZ + 0.6; }
`

function splitBy(material: THREE.Material, split: StopperSplit, keepCork: boolean) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, split)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBottle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBottle = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SPLIT_PARS}`)
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>\nif (potionIsCork() != ${keepCork}) discard;`,
      )
  }
  material.customProgramCacheKey = () => (keepCork ? 'potion-cork-split' : 'potion-wax-split')
}

export function corkMaterial(map: THREE.Texture, split: StopperSplit | null) {
  const look = STOPPER_LOOKS.cork
  const material = new THREE.MeshStandardMaterial({
    map,
    bumpMap: map,
    bumpScale: 2.5,
    roughness: look.roughness,
    color: new THREE.Color(...look.colour!),
    envMapIntensity: 0.3,
  })
  if (split) splitBy(material, split, true)
  return material
}

export function waxMaterial(hex: string, split: StopperSplit) {
  const look = STOPPER_LOOKS.wax
  const colour = new THREE.Color(hex)
  const material = new THREE.MeshPhysicalMaterial({
    color: colour,
    roughness: look.roughness,
    clearcoat: look.clearcoat,
    clearcoatRoughness: 0.18,
    sheen: 0.4,
    sheenColor: colour.clone().lerp(new THREE.Color('#ffffff'), 0.35),
    sheenRoughness: 0.5,
    emissive: colour.clone().multiplyScalar(look.glow),
    envMapIntensity: 0.9,
  })
  splitBy(material, split, false)
  return material
}

// ---- Labels ----------------------------------------------------------------------------------

export interface LabelLook {
  /** The most lines the name may take. */
  maxLines: number
  /** The ink's box, in mm in from each edge of the label: top, right, bottom, left. */
  inset: [number, number, number, number]
  /** The name's largest letters, mm. */
  maxLetterMm: number
  frame: 'rings' | 'rules' | 'tag'
}

export const LABEL_LOOKS: Record<LabelId, LabelLook | null> = {
  none: null,
  round: { maxLines: 3, inset: [0.2, 0.17, 0.2, 0.17], maxLetterMm: 5.5, frame: 'rings' },
  banner: { maxLines: 2, inset: [3.4, 7, 3.4, 7], maxLetterMm: 5.2, frame: 'rules' },
  // The tag's string runs through a U across its top, so the ink keeps to the card below it.
  tag: { maxLines: 2, inset: [7.4, 2.2, 2, 2.2], maxLetterMm: 4.6, frame: 'tag' },
}

export interface Paper {
  paper: string
  shade: string
  ink: string
  /** The paper's own faint light, so it reads in the dark room (linear). */
  emissive: Rgb
  roughness: number
  metalness: number
}

export const PAPERS: { plain: Paper; gold: Paper; twine: string } = {
  plain: {
    paper: '#eadcb8',
    shade: '#b99c6a',
    ink: '#2e1c10',
    emissive: scaleRgb(linear('#ffe2b8'), 0.1),
    roughness: 0.85,
    metalness: 0,
  },
  gold: {
    paper: '#f3cf62',
    shade: '#b07f1c',
    ink: '#3a2306',
    emissive: scaleRgb(linear('#ffd36e'), 0.14),
    roughness: 0.32,
    metalness: 0.2,
  },
  twine: '#8a6a45',
}

/** What the plain materials give off at rest, before any light: all under the bloom cap. */
export const RESTING_EMISSIVE = {
  paper: Math.max(...PAPERS.plain.emissive),
  goldPaper: Math.max(...PAPERS.gold.emissive),
  wax: STOPPER_LOOKS.wax.glow,
  liquidSelf: LIQUID.self,
  glassRim: Math.max(...STOPPER_GLASS(GLASS_LOOKS.clear).rim),
}

/** The name in `lines` lines at most (fewer if it has fewer words), split so the longest is shortest. */
export function labelLines(name: string, lines: number): string[] {
  const words = name.split(/\s+/).filter(Boolean)
  const n = Math.min(lines, words.length)
  let best: string[] = [words.join(' ')]
  let bestLongest = Infinity
  const split = (from: number, left: number, acc: string[]) => {
    if (left === 1) {
      const all = [...acc, words.slice(from).join(' ')]
      const longest = Math.max(...all.map((l) => l.length))
      if (longest < bestLongest) {
        bestLongest = longest
        best = all
      }
      return
    }
    for (let to = from + 1; to <= words.length - left + 1; to++)
      split(to, left - 1, [...acc, words.slice(from, to).join(' ')])
  }
  if (n > 0) split(0, n, [])
  return best
}

/** Which of a label's vertices are paper (1) and which a tag's string (0): the string's are at the uv origin. */
export function paperMask(part: MeshPart, tag: boolean): Float32Array {
  const n = part.positions.length / 3
  const mask = new Float32Array(n).fill(1)
  if (tag)
    for (let i = 0; i < n; i++) if (part.uvs[i * 2] === 0 && part.uvs[i * 2 + 1] === 0) mask[i] = 0
  return mask
}

export interface LabelArea {
  /** The label's uv extent in mm, centred on its middle. */
  halfWidth: number
  halfHeight: number
}

/** The uv extent of the paper in a label part. */
export function labelArea(part: MeshPart): LabelArea {
  let u = 0
  let v = 0
  for (let i = 0; i < part.uvs.length; i += 2) {
    u = Math.max(u, Math.abs(part.uvs[i]!))
    v = Math.max(v, Math.abs(part.uvs[i + 1]!))
  }
  return { halfWidth: u, halfHeight: v }
}

const PX_PER_MM = 28
const MAX_PX = 2048
const FONT = '"IM Fell English", Georgia, serif'

/** Paper and ink: the label's whole face drawn on its canvas, `area` mm either side of the middle. */
export function drawLabel(
  canvas: HTMLCanvasElement,
  look: LabelLook,
  area: LabelArea,
  name: string,
  gold: boolean,
): void {
  const k = Math.min(PX_PER_MM, MAX_PX / (2 * Math.max(area.halfWidth, area.halfHeight)))
  const w = Math.max(4, Math.round(2 * area.halfWidth * k))
  const h = Math.max(4, Math.round(2 * area.halfHeight * k))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const paper = gold ? PAPERS.gold : PAPERS.plain
  const mm = (v: number) => v * k

  const ground = ctx.createRadialGradient(
    w * 0.42,
    h * 0.4,
    0,
    w / 2,
    h / 2,
    Math.hypot(w, h) * 0.55,
  )
  ground.addColorStop(0, paper.paper)
  ground.addColorStop(0.7, paper.paper)
  ground.addColorStop(1, paper.shade)
  ctx.fillStyle = ground
  ctx.fillRect(0, 0, w, h)
  let seed = 11
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < (w * h) / 300; i++) {
    ctx.fillStyle = `rgba(110,80,40,${rand() * 0.08})`
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * mm(0.12), 1 + rand() * mm(0.12))
  }

  if (gold) {
    // A gilt edge: a bright band just inside the paper's rim, darker at its outer side.
    const edge = mm(0.9)
    ctx.lineWidth = edge
    ctx.strokeStyle = '#fff0b0'
    ctx.globalAlpha = 0.55
    if (look.frame === 'rings') {
      ctx.beginPath()
      ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - edge, 0, Math.PI * 2)
      ctx.stroke()
    } else ctx.strokeRect(edge, edge, w - 2 * edge, h - 2 * edge)
    ctx.globalAlpha = 1
  }
  ctx.strokeStyle = paper.ink
  ctx.fillStyle = paper.ink
  ctx.globalAlpha = 0.88
  const [top, right, bottom, left] = look.inset
  if (look.frame === 'rings') {
    const r = Math.min(w, h) / 2
    ctx.lineWidth = mm(0.35)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.86, 0, Math.PI * 2)
    ctx.stroke()
    ctx.lineWidth = mm(0.15)
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, r * 0.8, 0, Math.PI * 2)
    ctx.stroke()
  } else if (look.frame === 'rules') {
    for (const y of [mm(1.6), h - mm(1.6)]) {
      ctx.lineWidth = mm(0.3)
      ctx.beginPath()
      ctx.moveTo(mm(6.5), y)
      ctx.lineTo(w - mm(6.5), y)
      ctx.stroke()
    }
    ctx.lineWidth = mm(0.12)
    for (const y of [mm(2.3), h - mm(2.3)]) {
      ctx.beginPath()
      ctx.moveTo(mm(7.5), y)
      ctx.lineTo(w - mm(7.5), y)
      ctx.stroke()
    }
  } else {
    // The tag's punched hole, its ring, and a ruled line under the name.
    ctx.lineWidth = mm(0.5)
    ctx.globalAlpha = 0.35
    ctx.beginPath()
    ctx.arc(w / 2, mm(3), mm(1.7), 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 0.88
    ctx.lineWidth = mm(0.15)
    ctx.strokeRect(mm(1), mm(1), w - mm(2), h - mm(2))
  }

  // Ink box: fractions of the size for a round label, else mm.
  const fraction = look.frame === 'rings'
  const box = {
    x: fraction ? left * w : mm(left),
    y: fraction ? top * h : mm(top),
    w: w - (fraction ? (left + right) * w : mm(left + right)),
    h: h - (fraction ? (top + bottom) * h : mm(top + bottom)),
  }
  let chosen: { lines: string[]; size: number } = { lines: [name], size: 0 }
  for (let n = 1; n <= look.maxLines; n++) {
    const lines = labelLines(name, n)
    ctx.font = `100px ${FONT}`
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width / 100))
    const lineGap = 1.12
    let size = Math.min(box.w / widest, box.h / (lines.length * lineGap), mm(look.maxLetterMm))
    if (fraction) {
      // A round label's lines must sit inside its circle, not just its square.
      const r = (Math.min(w, h) / 2) * 0.76
      for (; size > 4; size *= 0.96) {
        const block = lines.length * size * lineGap
        const fits = lines.every((l, i) => {
          const y = -block / 2 + (i + 0.5) * size * lineGap
          const half = (ctx.measureText(l).width / 100) * size * 0.5
          return Math.hypot(half, Math.abs(y) + size * 0.4) <= r
        })
        if (fits) break
      }
    }
    if (size > chosen.size * 1.08) chosen = { lines, size }
  }
  const { lines, size } = chosen
  ctx.font = `${size}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const block = lines.length * size * 1.12
  const cy = box.y + box.h / 2
  lines.forEach((line, i) => {
    ctx.fillText(line, box.x + box.w / 2, cy - block / 2 + (i + 0.5) * size * 1.12)
  })
  ctx.globalAlpha = 1
}

const LABEL_PARS = /* glsl */ `
uniform vec3 uTwine;
uniform vec3 uPaperBack;
attribute float aPaper;
`

/** Paper with its ink on the face away from the glass; plain on the face against it; twine where it is string. */
export function labelMaterial(map: THREE.Texture, paper: Paper): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: paper.roughness,
    metalness: paper.metalness,
    emissive: new THREE.Color(...paper.emissive),
    emissiveMap: map,
    envMapIntensity: 0.5,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTwine = { value: new THREE.Color(PAPERS.twine) }
    shader.uniforms.uPaperBack = { value: new THREE.Color(paper.paper) }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${LABEL_PARS}\nvarying float vPaper;\nvarying float vFacesOut;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vPaper = aPaper;
vFacesOut = dot(normal.xy, position.xy);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform vec3 uTwine;\nuniform vec3 uPaperBack;\nvarying float vPaper;\nvarying float vFacesOut;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
if (vFacesOut < 0.0) diffuseColor.rgb = uPaperBack * 0.8;
if (vPaper < 0.5) diffuseColor.rgb = uTwine;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (vPaper < 0.5 || vFacesOut < 0.0) totalEmissiveRadiance *= 0.25;`,
      )
  }
  return material
}
