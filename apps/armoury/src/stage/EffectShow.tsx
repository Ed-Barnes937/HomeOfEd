import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'

import type { PotionEffect } from '../potion/effects.ts'
import {
  effectCount,
  effectParticle,
  effectReach,
  type Frame,
  MAX_POINTS,
  MAX_SPRITE_PX,
  newParticle,
  placeParticle,
  type Reach,
  SHAPES,
} from './effectKinds.ts'
import { REST_CAP, SOFT_CAP_GLSL } from './potionMaterials.ts'
import { RENDER_ORDER } from './PotionMesh.tsx'
import type { PotionShow } from './potionShow.ts'

const MAX_COLOURS = 4
/** The screen height `MAX_SPRITE_PX` is measured on; sprites keep their share of other screens. */
const PHONE_HEIGHT = 844
/** How far towards and away from the viewer the effect spreads, in bottle heights. */
const DEPTH = 0.1

const VERTEX = /* glsl */ `
attribute vec4 aLook;
attribute float aTint;
uniform vec3 uColours[${MAX_COLOURS}];
uniform float uSpritePx;
varying vec3 vColour;
varying float vAlpha;
varying float vShape;
varying float vWarp;
void main() {
  vAlpha = aLook.y;
  vShape = aLook.z;
  vWarp = aLook.w;
  vColour = uColours[int(aTint + 0.5)];
  if (vAlpha <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
  gl_PointSize = max(aLook.x * uSpritePx, 1.0);
}
`

const shape = (name: keyof typeof SHAPES) => `${SHAPES[name]}.5`

// One sprite per particle, drawn by its shape. Each adds its light and covers what is behind it by
// `cover`, or by its own light where that is more, so the canvas's alpha never falls below its colour.
const FRAGMENT = /* glsl */ `
uniform float uCap;
varying vec3 vColour;
varying float vAlpha;
varying float vShape;
varying float vWarp;
${SOFT_CAP_GLSL}
float effectStar(vec2 p, float r, float inner) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = inner * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
vec2 effectTurn(vec2 p, float by) {
  float s = sin(by);
  float k = cos(by);
  return mat2(k, -s, s, k) * p;
}
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  float r = length(c);
  float edge = 1.0 - smoothstep(0.8, 1.0, r);
  vec3 col = vColour;
  // The colour at full strength, so a dark potion's lights are as bright as a pale one's. ACES
  // washes anything much past 0.6 towards white, so the lights keep under it but for their cores.
  vec3 hue = vColour / max(max(vColour.r, vColour.g), max(vColour.b, 0.001));
  float a;
  float cover = 0.0;
  if (vShape < ${shape('bubble')} || (vShape > ${shape('wisp')} && vShape < ${shape('blob')})) {
    bool fat = vShape > ${shape('wisp')};
    vec2 q = vec2(c.x * (1.0 + vWarp), c.y * (1.0 - vWarp)) / (1.0 - abs(vWarp));
    float d = length(q);
    float body = 1.0 - smoothstep(0.92, 1.0, d);
    float rim = smoothstep(0.58, 0.86, d) * body;
    float glint = 1.0 - smoothstep(0.0, 0.26, length(q - vec2(-0.36, 0.4)));
    float low = 0.3 * (1.0 - smoothstep(0.0, 0.5, length(q - vec2(0.32, -0.42)))) * body;
    a = body * (fat ? 0.6 : 0.05) + rim * (fat ? 0.4 : 0.8) + glint + low;
    col = vColour * (fat ? 0.7 + 0.6 * rim : 0.5 + 1.4 * rim) + vec3(1.5 * glint + 0.6 * low);
    cover = fat ? 0.8 : 0.12;
  } else if (vShape < ${shape('glitter')}) {
    vec2 q = effectTurn(c, vWarp);
    float core = exp(-r * r * 40.0);
    float flare = exp(-abs(q.x) * 14.0 - abs(q.y) * 2.4) + exp(-abs(q.y) * 14.0 - abs(q.x) * 2.4);
    a = (core + 0.75 * flare + 0.4 * exp(-r * r * 6.0)) * edge;
    col = hue * 0.6 + vec3(0.8 * core);
  } else if (vShape < ${shape('star')}) {
    float star = 1.0 - smoothstep(-0.03, 0.04, effectStar(effectTurn(c, vWarp), 0.56, 0.5) - 0.05);
    a = 0.95 * star + 0.5 * exp(-r * r * 3.5) * edge;
    col = mix(hue * 0.55, mix(hue, vec3(1.0), 0.15) * 0.6, star) + vec3(0.25 * exp(-r * r * 24.0));
  } else if (vShape < ${shape('mote')}) {
    float core = exp(-r * r * 60.0);
    float mid = exp(-r * r * 14.0);
    a = (core + 0.6 * mid + 0.35 * exp(-r * r * 3.5)) * edge;
    col = vColour * (1.2 + mid) + vec3(1.6 * core);
  } else if (vShape < ${shape('ribbon')}) {
    a = 0.14 * exp(-r * r * 3.0) * edge;
    col = hue * 0.65 + vec3(0.2 * exp(-r * r * 20.0));
  } else if (vShape < ${shape('wisp')}) {
    // Smoke: a soft lump lit from the candle's side, greyed a little.
    bool puff = vShape < ${shape('smoke')};
    float lump = 1.0 - smoothstep(0.35, 1.0, r);
    float lit = 0.5 + 0.5 * dot(c, vec2(-0.6, 0.7));
    a = (puff ? 0.75 : 0.35) * lump;
    col = mix(vColour, vec3(dot(vColour, vec3(0.3, 0.5, 0.2))), 0.3) * (0.5 + 0.6 * lit);
    cover = puff ? 0.85 : 0.5;
  } else {
    a = 1.0 - smoothstep(0.55, 0.95, r);
    col = vColour * 0.8 + vec3(0.8 * (1.0 - smoothstep(0.0, 0.4, length(c - vec2(-0.3, 0.3)))));
    cover = 0.85;
  }
  a = clamp(a * vAlpha, 0.0, 1.0);
  if (a < 0.004) discard;
  gl_FragColor = vec4(potionCap(col, uCap), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  vec3 lit = gl_FragColor.rgb * a;
  gl_FragColor = vec4(lit, max(a * cover, max(max(lit.r, lit.g), lit.b)));
}
`

interface Shown {
  effect: PotionEffect | null
  seed: number
  /** The bottle's height in the mouth's frame, before the rig scales it. */
  bottle: number
}

const sameEffect = (a: PotionEffect, b: PotionEffect | null) =>
  a === b ||
  (b !== null &&
    a.kind === b.kind &&
    a.strength === b.strength &&
    a.colours.join() === b.colours.join())

/** The effect's one draw: buffers and a material built once, written each frame of a show and never grown. */
export function createField() {
  const position = new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 3), 3)
  const look = new THREE.BufferAttribute(new Float32Array(MAX_POINTS * 4), 4)
  const tint = new THREE.BufferAttribute(new Float32Array(MAX_POINTS), 1)
  for (const attribute of [position, look, tint]) attribute.setUsage(THREE.DynamicDrawUsage)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', position)
  geometry.setAttribute('aLook', look)
  geometry.setAttribute('aTint', tint)
  const uniforms = {
    uColours: { value: Array.from({ length: MAX_COLOURS }, () => new THREE.Color()) },
    uSpritePx: { value: MAX_SPRITE_PX },
    uCap: { value: REST_CAP },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  })

  // Where the neck was, and how far the frame let the effect reach, as each particle left it.
  const left = new Float32Array(MAX_POINTS * 6)
  const out = new Uint8Array(MAX_POINTS)
  const p = newParticle()
  const frame: Frame = { left: 0, right: 0, top: 0 }
  const reach: Reach = { left: 0, right: 0, up: 0 }
  const at = { x: 0, y: 0 }
  const s = { effect: null as PotionEffect | null, count: 0, colours: 1, age: 0, drawn: false }

  const clear = () => {
    if (!s.drawn) return
    for (let i = 0; i < MAX_POINTS; i++) look.array[i * 4 + 1] = 0
    look.needsUpdate = true
    out.fill(0)
    s.drawn = false
    s.age = 0
  }

  // The rig's camera sits on the z axis looking down it, so the frame is centred on that axis.
  const frameAt = (depth: number, projection: THREE.Matrix4) => {
    frame.top = depth / projection.elements[5]
    frame.right = depth / projection.elements[0]
    frame.left = -frame.right
  }

  return {
    geometry,
    material,
    dispose() {
      geometry.dispose()
      material.dispose()
    },
    draw(
      show: PotionShow,
      { effect, seed, bottle }: Shown,
      mouth: THREE.Object3D | null,
      camera: THREE.Camera,
      height: number,
      pixelRatio: number,
    ) {
      if (!(show.emit > 0) || !effect || !mouth) return clear()
      if (!sameEffect(effect, s.effect)) {
        clear()
        s.count = Math.min(effectCount(effect.kind, effect.strength), MAX_POINTS)
        s.colours = Math.min(effect.colours.length, MAX_COLOURS)
        for (let i = 0; i < s.colours; i++) uniforms.uColours.value[i]!.set(effect.colours[i]!)
      }
      s.effect = effect
      if (show.age < s.age) out.fill(0)
      s.age = show.age
      s.drawn = true
      const sprite = MAX_SPRITE_PX * (height / PHONE_HEIGHT)
      uniforms.uSpritePx.value = sprite * pixelRatio
      uniforms.uCap.value = show.cap
      // The mouth as it was last drawn.
      const m = mouth.matrixWorld.elements
      const size = bottle * Math.hypot(m[0], m[1], m[2])
      const eye = camera.position.z
      for (let i = 0; i < s.count; i++) {
        effectParticle(effect.kind, seed, i, show.age, effect.strength, p)
        const k = i * 6
        if (p.born && !out[i]) {
          out[i] = 1
          frameAt(eye - m[14], camera.projectionMatrix)
          effectReach(m[12], m[13], frame, size, reach)
          left[k] = m[12]!
          left[k + 1] = m[13]!
          left[k + 2] = m[14]!
          left[k + 3] = reach.left
          left[k + 4] = reach.right
          left[k + 5] = reach.up
        }
        const alpha = out[i] ? p.alpha * show.emit : 0
        look.array[i * 4 + 1] = alpha
        if (!(alpha > 0)) continue
        const depth = eye - left[k + 2]!
        frameAt(depth, camera.projectionMatrix)
        reach.left = left[k + 3]!
        reach.right = left[k + 4]!
        reach.up = left[k + 5]!
        placeParticle(
          p,
          left[k]!,
          left[k + 1]!,
          reach,
          frame,
          (p.size * sprite * frame.top) / height,
          at,
        )
        // Nearer or further along its line of sight, so it stays where it was placed on screen.
        const z = left[k + 2]! + p.z * DEPTH * size
        const nearer = (eye - z) / depth
        position.array[i * 3] = at.x * nearer
        position.array[i * 3 + 1] = at.y * nearer
        position.array[i * 3 + 2] = z
        look.array[i * 4] = p.size
        look.array[i * 4 + 2] = p.shape
        look.array[i * 4 + 3] = p.warp
        tint.array[i] = p.tint % s.colours
      }
      position.needsUpdate = true
      look.needsUpdate = true
      tint.needsUpdate = true
    },
  }
}

/**
 * What comes out of the neck when the cork pops (ADR 0111, "The uncorking"): one draw of sprites,
 * placed in the scene's own frame from where the mouth was as each left it, so the effect rises
 * straight up whatever the bottle does afterwards. Mounted after whatever writes `show`.
 */
export function EffectShow({
  show,
  mouth,
  ...shown
}: Shown & {
  show: { readonly current: PotionShow }
  /** At the bottle's mouth, inside the held bottle. */
  mouth: RefObject<THREE.Object3D | null>
}) {
  const field = useMemo(createField, [])
  useEffect(() => () => field.dispose(), [field])
  const latest = useRef(shown)
  latest.current = shown
  useFrame(({ camera, size, gl }) => {
    field.draw(show.current, latest.current, mouth.current, camera, size.height, gl.getPixelRatio())
  })
  return (
    <points
      geometry={field.geometry}
      material={field.material}
      renderOrder={RENDER_ORDER.particles}
      frustumCulled={false}
      matrixAutoUpdate={false}
      matrixWorldAutoUpdate={false}
    />
  )
}
