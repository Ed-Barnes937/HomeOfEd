import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import { MAX_POURS } from '../potion/potionSchema.ts'
import {
  type CavityRadii,
  type MoteKind,
  type MotePool,
  MOTE_PROGRAMS,
  traitLook,
} from '../potion/traits.ts'
import { type LayerLook, type LiquidUniforms, SOFT_CAP_GLSL } from './potionMaterials.ts'

/** The cavity's radius is sampled this many times up its height for the shader. */
export const MOTE_RADII = 48

const code = (kind: MoteKind | null) => (kind ? MOTE_PROGRAMS[kind].code : 0)
const FLECK = MOTE_PROGRAMS.fleck.code
const BUBBLE = MOTE_PROGRAMS.bubble.code

// Every mote rests at its pool point; the band it rests in picks its program, so the bands stay
// level in any pose. Then it moves on the liquid's clock, fades at its band's soft edges and the
// wall, and dims through the liquid between it and the eye.
const MOTES_VERTEX = /* glsl */ `
attribute vec4 aSeed;
uniform vec3 uUp, uEye, uKeyDir, uKeyColour;
uniform float uLevels[${MAX_POURS}];
uniform float uEdges[${MAX_POURS - 1}];
uniform int uCount;
uniform float uFloor, uTime, uHalfHeight, uPixelRatio;
uniform vec3 uColour[${MAX_POURS}];
uniform float uKind[${MAX_POURS}];
uniform float uDensity[${MAX_POURS}];
uniform vec3 uTint[${MAX_POURS}];
uniform float uRadius[${MOTE_RADII}];
uniform vec2 uRadiusAt;
varying vec3 vColour;
varying float vAlpha;
varying float vKind;
varying float vSpin;
varying float vGlint;
vec3 motesHash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float motesRadius(float z) {
  float f = clamp((z - uRadiusAt.x) / uRadiusAt.y, 0.0, ${MOTE_RADII - 1}.0 - 0.001);
  int i = int(f);
  return mix(uRadius[i], uRadius[i + 1], fract(f));
}
void main() {
  vColour = vec3(0.0);
  vAlpha = 0.0;
  vKind = 0.0;
  vSpin = 0.0;
  vGlint = 0.0;
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  gl_PointSize = 0.0;
  float h0 = dot(position, uUp);
  int band = -1;
  for (int i = 0; i < ${MAX_POURS}; i++)
    if (band < 0 && i < uCount && h0 <= uLevels[i]) band = i;
  if (band < 0 || h0 < uFloor) return;
  float kind = uKind[band];
  if (kind < 0.5 || aSeed.x >= uDensity[band]) return;
  float lo = band == 0 ? uFloor : uLevels[band - 1];
  float hi = uLevels[band];
  bool top = band == uCount - 1;
  float t = uTime;
  vec3 p = position;
  float size;
  float fade = 1.0;
  if (kind < ${FLECK}.5) {
    p += 0.7 * vec3(sin(t * 0.37 + aSeed.y * 40.0), sin(t * 0.29 + aSeed.z * 17.0), sin(t * 0.33 + aSeed.w * 23.0));
    size = 0.5 + 0.65 * aSeed.z * aSeed.z;
  } else if (kind < ${BUBBLE}.5) {
    // Most bubbles rise in a few streams from the band's floor; the rest on their own.
    vec3 e1 = normalize(cross(vec3(0.0, 1.0, 0.0), uUp));
    vec3 e2 = cross(uUp, e1);
    vec2 across = vec2(dot(position, e1), dot(position, e2));
    vec2 cell = floor(across / 10.0);
    vec3 site = motesHash3(vec3(cell, float(band) + 0.5));
    if (aSeed.w < 0.7) across = (cell + 0.2 + 0.6 * site.xy) * 10.0 + 0.4 * (aSeed.zy - 0.5);
    float span = max(hi - lo, 0.5);
    float rise = fract(aSeed.y + t * (6.0 + 6.0 * aSeed.z) / span);
    across.x += 0.25 * sin(t * 7.0 + aSeed.w * 50.0) * rise;
    p = e1 * across.x + e2 * across.y + uUp * (lo + span * rise);
    size = (0.6 + 0.9 * aSeed.z * aSeed.z) * mix(0.7, 1.15, rise);
    fade = smoothstep(0.0, 0.08, rise) * (1.0 - smoothstep(0.86, 1.0, rise));
  } else {
    p += 1.8 * vec3(sin(t * 0.13 + aSeed.y * 40.0), sin(t * 0.11 + aSeed.z * 17.0), sin(t * 0.09 + aSeed.w * 23.0));
    size = 1.0 + 1.8 * aSeed.w;
  }
  float h = dot(p, uUp);
  if (kind > ${BUBBLE}.5 || kind < ${FLECK}.5) {
    float eLo = band == 0 ? 0.0 : uEdges[band - 1];
    float eHi = top ? 0.0 : uEdges[band];
    if (band > 0) fade *= smoothstep(lo - eLo, lo + eLo, h);
    fade *= top ? 1.0 - smoothstep(hi - 1.5 * size, hi - 0.5 * size, h)
                : 1.0 - smoothstep(hi - eHi, hi + eHi, h);
  }
  float R = motesRadius(p.z);
  float r = length(p.xy);
  fade *= 1.0 - smoothstep(R - 1.5 * size, R - 0.5 * size, r);
  if (fade < 0.01 || p.z < uRadiusAt.x) return;

  // The liquid between the mote and the eye, as far as the wall or the surface.
  vec3 toEye = uEye - p;
  float eyeD = length(toEye);
  vec3 v = toEye / eyeD;
  float A = dot(v.xy, v.xy);
  float B = dot(p.xy, v.xy);
  float C = dot(p.xy, p.xy) - R * R;
  float through = A > 1e-5 ? (-B + sqrt(max(B * B - A * C, 0.0))) / A : 1e3;
  float rising = dot(v, uUp);
  if (rising > 1e-4) through = min(through, (uLevels[uCount - 1] - h) / rising);
  through = clamp(through, 0.0, eyeD);
  vec3 c = uColour[band];
  vec3 hue = c / max(max(c.r, c.g), max(c.b, 1e-3));
  float milk = kind > ${BUBBLE}.5 ? 0.05 : 0.0;
  vec3 seen = exp(-through * (0.02 + milk + 0.035 * (1.0 - hue)));

  vec4 world = modelMatrix * vec4(p, 1.0);
  float mm = length(modelMatrix[0].xyz);
  vec3 axis = (modelMatrix * vec4(0.0, 0.0, p.z, 1.0)).xyz;
  float candle = clamp(0.5 + dot(world.xyz - axis, uKeyDir) / (max(R, 1.0) * mm * 1.2), 0.0, 1.0);
  vec3 eye = normalize(cameraPosition - world.xyz);
  if (kind < ${FLECK}.5) {
    vec3 facet = normalize(motesHash3(aSeed.yzw * 91.0) * 2.0 - 1.0 +
      0.6 * vec3(sin(t * 0.8 + aSeed.y * 30.0), cos(t * 0.6 + aSeed.z * 20.0), sin(t * 0.7 + aSeed.w * 10.0)));
    facet = normalize(mat3(modelMatrix) * facet);
    float spark = pow(abs(dot(facet, normalize(uKeyDir + eye))), 40.0);
    vec3 lit = mix(vec3(1.0), uKeyColour, 0.5);
    vColour = uTint[band] * (lit * (0.5 + 0.5 * candle) + uKeyColour * 3.0 * spark * candle) * seen;
    vSpin = aSeed.w * 6.2832 + t * 0.5 * (aSeed.y - 0.5);
    vAlpha = fade * mix(0.4, 1.0, seen.g);
  } else if (kind < ${BUBBLE}.5) {
    float clear = max(max(seen.r, seen.g), seen.b);
    vColour = mix(c, vec3(1.0), 0.65) * mix(vec3(1.0), uKeyColour, 0.4) * (0.75 + 0.55 * candle) * mix(vec3(clear), seen, 0.5);
    vGlint = (0.6 + 1.6 * candle) * clear;
    vAlpha = fade * mix(0.3, 1.0, clear);
  } else {
    vColour = uTint[band] * mix(vec3(1.0), uKeyColour, 0.4) * (0.45 + 0.4 * candle) * seen;
    vAlpha = fade * (0.55 + 0.45 * aSeed.y) * mix(0.35, 1.0, seen.g);
  }
  vKind = kind;
  vec4 mv = viewMatrix * world;
  float px = size * length(modelViewMatrix[0].xyz) * projectionMatrix[1][1] * uHalfHeight / -mv.z;
  gl_PointSize = clamp(px, 1.4 * uPixelRatio, 40.0);
  gl_Position = projectionMatrix * mv;
}
`

const MOTES_FRAGMENT = /* glsl */ `
uniform float uCap;
varying vec3 vColour;
varying float vAlpha;
varying float vKind;
varying float vSpin;
varying float vGlint;
${SOFT_CAP_GLSL}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r = length(c);
  if (r > 1.0 || vKind < 0.5) discard;
  vec3 col = vColour;
  float a;
  // Each mote adds its light and hides only a little of the liquid behind it, so none reads as a hole.
  float cover;
  if (vKind < ${FLECK}.5) {
    float s = sin(vSpin);
    float k = cos(vSpin);
    vec2 q = mat2(k, -s, s, k) * c;
    a = 1.0 - smoothstep(0.55, 0.95, max(abs(q.x) * 0.87 + abs(q.y) * 0.5, abs(q.y)));
    cover = 0.3;
  } else if (vKind < ${BUBBLE}.5) {
    float rim = smoothstep(0.5, 0.82, r) * (1.0 - smoothstep(0.86, 1.0, r));
    float glint = 1.0 - smoothstep(0.0, 0.3, length(c - vec2(-0.36, -0.36)));
    a = 0.12 + 0.88 * rim + glint;
    col = col * (0.3 + rim) + vGlint * glint;
    cover = 0.15;
  } else {
    a = exp(-r * r * 3.2) - 0.04;
    cover = 0.25;
  }
  a = clamp(a * vAlpha, 0.0, 1.0);
  if (a < 0.004) discard;
  gl_FragColor = vec4(potionCap(col, uCap), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * a, a * cover);
}
`

export interface MoteUniforms {
  [name: string]: THREE.IUniform
  uKind: THREE.IUniform<number[]>
  uDensity: THREE.IUniform<number[]>
  uTint: THREE.IUniform<THREE.Vector3[]>
  uRadius: THREE.IUniform<number[]>
  uRadiusAt: THREE.IUniform<THREE.Vector2>
  uHalfHeight: THREE.IUniform<number>
  uPixelRatio: THREE.IUniform<number>
}

export interface Motes {
  uniforms: MoteUniforms
  material: THREE.ShaderMaterial
  /** Each band's motes from its trait: its program, its share of the pool and its colour. */
  setLayers(layers: readonly LayerLook[]): void
  setCavity(cavity: CavityRadii): void
  dispose(): void
}

/** The motes' one material, reading the liquid's own uniforms for its bands, clock and light. */
export function createMotes(liquid: LiquidUniforms): Motes {
  const shared = [
    'uUp',
    'uEye',
    'uKeyDir',
    'uKeyColour',
    'uLevels',
    'uEdges',
    'uCount',
    'uFloor',
    'uTime',
    'uColour',
    'uCap',
  ] as const
  const uniforms: MoteUniforms = {
    ...Object.fromEntries(shared.map((name) => [name, liquid[name]])),
    uKind: { value: new Array<number>(MAX_POURS).fill(0) },
    uDensity: { value: new Array<number>(MAX_POURS).fill(0) },
    uTint: { value: Array.from({ length: MAX_POURS }, () => new THREE.Vector3()) },
    uRadius: { value: new Array<number>(MOTE_RADII).fill(0) },
    uRadiusAt: { value: new THREE.Vector2(0, 1) },
    uHalfHeight: { value: 400 },
    uPixelRatio: { value: 1 },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: MOTES_VERTEX,
    fragmentShader: MOTES_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })
  const colour = new THREE.Color()
  return {
    uniforms,
    material,
    setLayers(layers) {
      for (let i = 0; i < MAX_POURS; i++) {
        const layer = layers[i]
        const look = layer ? traitLook(layer.trait, layer.ingredient) : null
        uniforms.uKind.value[i] = code(look?.motes ?? null)
        uniforms.uDensity.value[i] = look?.motes ? MOTE_PROGRAMS[look.motes].density : 0
        colour.set(look?.tint ?? layer?.colour ?? '#ffffff')
        uniforms.uTint.value[i]!.set(colour.r, colour.g, colour.b)
      }
    },
    setCavity({ radii, z0, dz }) {
      for (let i = 0; i < MOTE_RADII; i++) uniforms.uRadius.value[i] = radii[i] ?? 0
      uniforms.uRadiusAt.value.set(z0, dz)
    },
    dispose() {
      material.dispose()
    },
  }
}

/** The pool's rest points and seeds as one point cloud; a new pool, a new geometry. */
export function motesGeometry(pool: MotePool): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(pool.rest, 3))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(pool.seed, 4))
  geometry.setDrawRange(0, pool.count)
  return geometry
}

const bufferSize = new THREE.Vector2()

/** Every point-like trait in one draw, inside the liquid, between it and the glass's near half. */
export function LiquidMotes({
  motes,
  pool,
  renderOrder,
}: {
  motes: Motes
  pool: MotePool
  renderOrder: number
}) {
  const geometry = useMemo(() => motesGeometry(pool), [pool])
  useEffect(() => () => geometry.dispose(), [geometry])
  const onBeforeRender: THREE.Object3D['onBeforeRender'] = (renderer) => {
    renderer.getDrawingBufferSize(bufferSize)
    motes.uniforms.uHalfHeight.value = bufferSize.y / 2
    motes.uniforms.uPixelRatio.value = renderer.getPixelRatio()
  }
  return (
    <points
      geometry={geometry}
      material={motes.material}
      renderOrder={renderOrder}
      frustumCulled={false}
      onBeforeRender={onBeforeRender}
    />
  )
}
