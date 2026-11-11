import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

import { srgbToLinear } from '../items/colour.ts'
import type { SwordSpec } from '../sword/compile.ts'
import { sample } from '../sword/curve.ts'
import {
  buildSwordMesh,
  swordGemPoses,
  tipPose,
  type SwordMesh as SwordParts,
} from '../sword/geometry.ts'
import { engravingMask, runeMask, type BladeMask } from '../sword/runes.ts'
import type { MeshPart } from '../sword/sweep.ts'
import { gemMaterial, stoneGeometry } from './Gems.tsx'
import { GEM_REST } from './gemGlow.ts'
import { MM } from './scene.tsx'
import { BLOOM_THRESHOLD } from './stage.ts'
import { SWORD_REST, swordGlow, WAKE_CAP, wakeLift, type SwordGlow } from './swordGlow.ts'
import {
  bladeMaterial,
  bladeUniforms,
  boneMaterial,
  clayMaterial,
  dyeFor,
  FITTINGS,
  fittingsMaterial,
  fittingsUniforms,
  PATTERNS,
  prepareSwordTextures,
  REST_CAP,
  STEELS,
  SWORD_TEXTURES,
  textileMaterial,
  textileUniforms,
  type SwordTextures,
  type Textile,
} from './swordMaterials.ts'
import { addFinish, WOODS } from './woodFinish.ts'

export { prepareSwordTextures, SWORD_TEXTURES, type SwordTextures } from './swordMaterials.ts'

/** The dev-only switch that draws every part in plain grey, to judge form alone. */
const CLAY =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('clay')

/** Where the sword's point is in its group's own space (along z, centred), scene units. */
export function swordTipPoint(spec: SwordSpec): [number, number, number] {
  const { position: p } = tipPose(spec)
  return [p[0] * MM, p[1] * MM, (p[2] - spec.lengthMm / 2) * MM]
}

export interface FrameScheduler {
  request(run: () => void): unknown
  cancel(handle: unknown): void
}

const animationFrames: FrameScheduler = {
  request: (run) => requestAnimationFrame(run),
  cancel: (handle) => cancelAnimationFrame(handle as number),
}

/** Builds only the latest input, once, on the next frame: a slider dragged across a frame costs one build. */
export function latestOnly<I, O>(
  build: (input: I) => O,
  built: (output: O) => void,
  frames = animationFrames,
) {
  let latest: { input: I } | null = null
  let handle: unknown = null
  return {
    request(input: I) {
      latest = { input }
      if (handle !== null) return
      handle = frames.request(() => {
        handle = null
        const next = latest
        latest = null
        if (next) built(build(next.input))
      })
    },
    cancel() {
      if (handle !== null) frames.cancel(handle)
      handle = null
      latest = null
    },
  }
}

interface Built {
  spec: SwordSpec
  parts: SwordParts
  rune: BladeMask | null
  engraving: BladeMask | null
}

const buildAll = (spec: SwordSpec): Built => ({
  spec,
  parts: buildSwordMesh(spec),
  rune: runeMask(spec),
  engraving: engravingMask(spec),
})

/** The mesh for `spec`: built at once the first time, then on the next frame after each change. */
function useSwordBuild(spec: SwordSpec): Built {
  const [built, setBuilt] = useState(() => buildAll(spec))
  const [builder] = useState(() => latestOnly(buildAll, setBuilt))
  useEffect(() => {
    if (built.spec !== spec) builder.request(spec)
  }, [spec, built.spec, builder])
  useEffect(() => () => builder.cancel(), [builder])
  return built
}

/** Copies a part into `geometry` when its buffers are the same size, else replaces it. */
function fillGeometry(
  geometry: THREE.BufferGeometry | null,
  part: MeshPart,
  extra: Record<string, { array: Float32Array; size: number }> = {},
): THREE.BufferGeometry {
  const attrs: Record<string, { array: Float32Array; size: number }> = {
    position: { array: part.positions, size: 3 },
    normal: { array: part.normals, size: 3 },
    uv: { array: part.uvs, size: 2 },
    ...Object.fromEntries(Object.entries(part.attrs).map(([k, array]) => [k, { array, size: 1 }])),
    ...extra,
  }
  const index = geometry?.getIndex()
  const fits =
    geometry !== null &&
    index?.array.length === part.indices.length &&
    Object.entries(attrs).every(
      ([k, a]) => geometry.getAttribute(k)?.array.length === a.array.length,
    ) &&
    Object.keys(geometry.attributes).length === Object.keys(attrs).length
  if (fits) {
    for (const [k, a] of Object.entries(attrs)) {
      const attribute = geometry.getAttribute(k) as THREE.BufferAttribute
      ;(attribute.array as Float32Array).set(a.array)
      attribute.needsUpdate = true
    }
    ;(index.array as Uint32Array).set(part.indices)
    index.needsUpdate = true
    geometry.computeBoundingSphere()
    return geometry
  }
  geometry?.dispose()
  const g = new THREE.BufferGeometry()
  for (const [k, a] of Object.entries(attrs))
    g.setAttribute(k, new THREE.BufferAttribute(a.array, a.size))
  g.setIndex(new THREE.BufferAttribute(part.indices, 1))
  return g
}

/** The temper line needs each point's distance from the edge and the blade's width there. */
function edgeAttrs(spec: SwordSpec, part: MeshPart) {
  const n = part.positions.length / 3
  const fromEdge = new Float32Array(n)
  const width = new Float32Array(n)
  if (spec.finish.pattern === 'temper') {
    const b = spec.blade
    for (let i = 0; i < n; i++) {
      const u = part.attrs.aAlong![i]!
      const edge = sample(b.halfWidth, u)
      fromEdge[i] = edge - part.uvs[i * 2]!
      width[i] = edge + (b.backWidth ? sample(b.backWidth, u) : edge)
    }
  }
  return { aFromEdge: { array: fromEdge, size: 1 }, aWidth: { array: width, size: 1 } }
}

/** A wood grip goes through the wand's own finish: it wants its UVs per 110 mm and the wand's zones. */
function woodAttrs(part: MeshPart) {
  const n = part.positions.length / 3
  const uv = new Float32Array(part.uvs.length)
  for (let i = 0; i < uv.length; i++) uv[i] = part.uvs[i]! / 110
  return {
    uv: { array: uv, size: 2 },
    aStain: { array: new Float32Array(n), size: 1 },
    aZone: { array: new Float32Array(n * 3), size: 3 },
    aBark: { array: new Float32Array(n), size: 1 },
  }
}

function useGeometries(built: Built) {
  const refs = useRef<{
    blade: THREE.BufferGeometry | null
    fittings: THREE.BufferGeometry | null
    grip: THREE.BufferGeometry | null
  }>({
    blade: null,
    fittings: null,
    grip: null,
  })
  const geometries = useMemo(() => {
    const { spec, parts } = built
    const r = refs.current
    r.blade = fillGeometry(r.blade, parts.blade, edgeAttrs(spec, parts.blade))
    r.fittings = fillGeometry(r.fittings, parts.fittings)
    r.grip = fillGeometry(
      r.grip,
      parts.grip,
      spec.grip.wrap === 'wood' ? woodAttrs(parts.grip) : {},
    )
    return { ...r }
  }, [built])
  useEffect(
    () => () => {
      const r = refs.current
      r.blade?.dispose()
      r.fittings?.dispose()
      r.grip?.dispose()
    },
    [],
  )
  return geometries as {
    blade: THREE.BufferGeometry
    fittings: THREE.BufferGeometry
    grip: THREE.BufferGeometry
  }
}

function maskTexture(mask: BladeMask | null): THREE.DataTexture | null {
  if (!mask) return null
  const t = new THREE.DataTexture(
    mask.data as Uint8Array<ArrayBuffer>,
    mask.width,
    mask.height,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  )
  t.unpackAlignment = 1
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.generateMipmaps = true
  t.anisotropy = 8
  t.needsUpdate = true
  return t
}

const TEXTILE_OF: Record<string, Textile> = { leather: 'leather', cord: 'cord', diamond: 'weave' }

/** The grip's mean girth round, so the leather's one seam lands underneath. */
function gripAround(spec: SwordSpec): number {
  const r = sample(spec.grip.radius, 0.5)
  return Math.PI * r * (1 + spec.grip.oval) * 1.02
}

/** The glint's light at its height: the window's cool white, over the bloom (ADR 0100). */
const GLINT_LIGHT = new THREE.Color('#f2f6ff').multiplyScalar(1.5 * BLOOM_THRESHOLD)
/** The faint light waking runes throw on the fuller's floor round them, times their colour. */
const FULLER_TINT = 0.2
/** How much brighter gems glow as they catch the light, and at the height of the wake. */
const GEM_WAKE = 2.2

/** Where the wake starts along the blade (0 to 1): at the runes, at the guard for gems alone, or nowhere. */
export function wakeFrom(spec: SwordSpec): number | null {
  if (spec.runes) return (spec.runes.from - spec.blade.from) / (spec.blade.to - spec.blade.from)
  return spec.glow ? 0 : null
}

/** The brighter of two overlapping flourishes' light, so a tap mid-wake never drops the glow. */
function brighter(a: SwordGlow, b: SwordGlow): SwordGlow {
  const glint = a.glint >= b.glint ? a : b
  const runes = a.runes >= b.runes ? a : b
  return {
    glintAt: glint.glintAt,
    glint: glint.glint,
    runes: runes.runes,
    wake: runes.wake,
    cap: Math.max(a.cap, b.cap),
    gems: Math.max(a.gems, b.gems),
  }
}

export function SwordMesh({
  spec,
  flourishAt,
  reducedMotion = false,
}: {
  spec: SwordSpec
  /** Clock time the close look's latest flourish began; absent on the anvil, which stays at rest. */
  flourishAt?: number | null
  reducedMotion?: boolean
}) {
  const textures = useTexture(SWORD_TEXTURES) as SwordTextures
  useMemo(() => prepareSwordTextures(textures), [textures])
  const built = useSwordBuild(spec)
  const geometries = useGeometries(built)
  const shown = built.spec

  const blade = useMemo(() => bladeUniforms(textures), [textures])
  const fittings = useMemo(() => fittingsUniforms(textures), [textures])
  const cap = useMemo(() => ({ value: REST_CAP }), [])
  const textile = TEXTILE_OF[shown.grip.wrap]
  const textileU = useMemo(
    () => (textile ? textileUniforms(textures, textile) : null),
    [textures, textile],
  )

  const { steel, fittings: metal } = shown.finish
  const materials = useMemo(() => {
    if (CLAY) {
      const clay = clayMaterial()
      return { blade: clay, fittings: clay, grip: clay }
    }
    const fittingsRow = FITTINGS[metal]
    const grip = (() => {
      switch (shown.grip.wrap) {
        case 'wire':
          return fittingsMaterial(fittingsRow, fittings, 0.25)
        case 'ribbed':
          return boneMaterial(cap)
        case 'wood':
          return null
        default:
          return textileMaterial(textile!, textileU!)
      }
    })()
    return {
      blade: bladeMaterial(STEELS[steel], blade),
      fittings: fittingsMaterial(fittingsRow, fittings),
      grip,
    }
  }, [steel, metal, shown.grip.wrap, textile, textileU, blade, fittings, cap])
  useEffect(
    () => () => {
      materials.blade.dispose()
      materials.fittings.dispose()
      materials.grip?.dispose()
    },
    [materials],
  )

  const runeTexture = useMemo(() => maskTexture(built.rune), [built.rune])
  const engravingTexture = useMemo(() => maskTexture(built.engraving), [built.engraving])
  useEffect(() => () => runeTexture?.dispose(), [runeTexture])
  useEffect(() => () => engravingTexture?.dispose(), [engravingTexture])

  useLayoutEffect(() => {
    const b = shown.blade
    const pattern = PATTERNS[shown.finish.pattern]
    blade.uBladeZ.value.set(b.from, b.to - b.from)
    const steelRow = STEELS[shown.finish.steel]
    blade.uBareEdge.value = steelRow.bareEdge ? 1 : 0
    blade.uTile.value.set(...steelRow.grain.tile)
    blade.uBrushDepth.value = steelRow.grain.depth
    blade.uScratch.value = steelRow.grain.scratch
    blade.uHammer.value = steelRow.grain.hammer
    blade.uGrind.value = steelRow.grain.grind
    blade.uPatternKind.value = pattern.kind
    blade.uPatternMix.value = pattern.mix
    blade.uPatternLight.value.setRGB(...pattern.light)
    blade.uPatternDark.value.setRGB(...pattern.dark)
    blade.uPatternRough.value.set(...pattern.roughness)
    blade.uWear.value = shown.finish.wear
    fittings.uWear.value = shown.finish.wear
    blade.uRuneOn.value = built.rune && runeTexture ? 1 : 0
    blade.uRuneMap.value = runeTexture
    if (built.rune) {
      const { from, to, x0, x1 } = built.rune.rect
      blade.uRuneRect.value.set(from, to, x0, x1)
    }
    blade.uRuneInFuller.value = shown.runes?.where === 'fuller' ? 1 : 0
    blade.uGlintPickEdge.value = b.edges === 'double' ? 1 : 0
    if (shown.runes) blade.uRuneColour.value.setRGB(...srgbToLinear(shown.runes.colour))
    blade.uEngraveOn.value = built.engraving && engravingTexture ? 1 : 0
    blade.uEngraveMap.value = engravingTexture
    if (built.engraving) {
      const { from, to, x0, x1 } = built.engraving.rect
      blade.uEngraveRect.value.set(from, to, x0, x1)
    }
    if (textileU) {
      textileU.uAbsorb.value.set(...dyeFor(shown.finish.gripColour))
      textileU.uWear.value = shown.finish.wear
      textileU.uGripLength.value = shown.grip.to - shown.grip.from
      if (textile === 'leather') textileU.uTile.value.x = gripAround(shown)
    }
  }, [shown, built, blade, fittings, textileU, textile, runeTexture, engravingTexture])

  const gems = useMemo(
    () =>
      swordGemPoses(shown).map(({ position, normal, along, radius, cut }) => {
        const y = new THREE.Vector3(...normal)
        const z = new THREE.Vector3(...along)
        const x = new THREE.Vector3().crossVectors(y, z)
        return {
          position,
          radius,
          cut,
          quaternion: new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(x, y, z),
          ),
        }
      }),
    [shown],
  )
  const cut = gems[0]?.cut ?? 'round'
  const stone = useMemo(() => stoneGeometry(cut), [cut])
  useEffect(() => () => stone.dispose(), [stone])
  const gemCap = useMemo(() => ({ value: GEM_REST.cap }), [])
  const glow = shown.glow
  const gemMat = useMemo(
    () => (glow ? gemMaterial({ glow: glow.colour, body: glow.body }, gemCap, true) : null),
    [glow, gemCap],
  )
  useEffect(() => () => gemMat?.dispose(), [gemMat])

  const flourishes = useRef<{ latest: number | null; earlier: number | null }>({
    latest: null,
    earlier: null,
  })
  const from = useMemo(() => wakeFrom(shown), [shown])
  useFrame(({ clock }) => {
    if (flourishAt === undefined) return
    if (flourishAt !== flourishes.current.latest)
      flourishes.current = { latest: flourishAt, earlier: flourishes.current.latest }
    const { latest, earlier } = flourishes.current
    const now = clock.elapsedTime
    const at = (start: number | null) =>
      start === null ? SWORD_REST : swordGlow(now - start, reducedMotion, from)
    const g = brighter(at(latest), at(earlier))
    const lift = wakeLift(g)
    blade.uGlintAt.value = g.glintAt ?? -1
    blade.uGlintLight.value.copy(GLINT_LIGHT).multiplyScalar(g.glint)
    blade.uRuneGlow.value = g.runes
    blade.uRuneWarm.value = lift
    blade.uRuneFront.value = g.wake
    blade.uFullerTint.value = FULLER_TINT * lift
    blade.uGlowCap.value = g.cap
    if (gemMat) {
      gemMat.emissiveIntensity = GEM_REST.emissive * (1 + (GEM_WAKE - 1) * g.gems)
      gemCap.value = GEM_REST.cap + (WAKE_CAP - GEM_REST.cap) * g.gems
    }
  })

  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <group position={[0, 0, (-shown.lengthMm / 2) * MM]} scale={MM}>
        <mesh geometry={geometries.blade} material={materials.blade} />
        <mesh geometry={geometries.fittings} material={materials.fittings} />
        {materials.grip ? (
          <mesh geometry={geometries.grip} material={materials.grip} />
        ) : (
          <WoodGrip geometry={geometries.grip} textures={textures} />
        )}
        {gemMat &&
          gems.map((g, i) => (
            <mesh
              key={i}
              geometry={stone}
              material={CLAY ? materials.fittings : gemMat}
              position={g.position}
              quaternion={g.quaternion}
              scale={g.radius}
            />
          ))}
      </group>
    </group>
  )
}

function WoodGrip({
  geometry,
  textures,
}: {
  geometry: THREE.BufferGeometry
  textures: SwordTextures
}) {
  const walnut = WOODS.walnut!
  const uniforms = useMemo(
    () => ({
      uStainAbsorb: { value: new THREE.Vector3() },
      uWoodLum: { value: walnut.lum },
      uGrain: { value: walnut.grain },
      uMetalColour: { value: new THREE.Color() },
      uMetalRough: { value: 0.3 },
      uMetalness: { value: 1 },
      uStainGloss: { value: 0.45 },
      uPaintColour: { value: new THREE.Color() },
      uBoneColour: { value: new THREE.Color() },
      uMatte: { value: 0 },
      uRoughMean: { value: walnut.rough },
      uPores: { value: walnut.pores * 0.5 },
      uSoak: { value: 1.2 },
      uBarkColour: { value: new THREE.Color(walnut.bark) },
    }),
    [walnut],
  )
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        map={textures.walnutColour}
        roughnessMap={textures.walnutRough}
        bumpMap={textures.walnutRough}
        bumpScale={0.8}
        roughness={0.62}
        envMapIntensity={0.8}
        color={walnut.tint}
        onBeforeCompile={(shader) => addFinish(shader, uniforms)}
      />
    </mesh>
  )
}
