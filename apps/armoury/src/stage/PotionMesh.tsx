import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'

import type { PotionSpec } from '../potion/compile.ts'
import { buildPotionMesh, type PotionMesh as PotionParts } from '../potion/geometry.ts'
import { bandTops, bottleProfile, LIQUID_GAP_MM } from '../potion/profile.ts'
import { floorAt, levelsAt, levelTable, type LevelTable } from '../potion/tipped.ts'
import { MAX_POURS } from '../potion/potionSchema.ts'
import { type CavityRadii, cavityRadii, type MotePool, motePool } from '../potion/traits.ts'
import { createMotes, LiquidMotes, MOTE_RADII } from './LiquidMotes.tsx'
import { fillGeometry, latestOnly } from './meshBuffers.ts'
import {
  corkMaterial,
  corkTexture,
  createGlass,
  createLiquid,
  drawLabel,
  GLASS_LOOKS,
  LABEL_LOOKS,
  labelArea,
  labelMaterial,
  type LayerLook,
  LIQUID,
  type LiquidClock,
  PAPERS,
  paperMask,
  STOPPER_GLASS,
} from './potionMaterials.ts'
import { CANDLE_AT, LAMPS, MOON_AT } from './potionScene.tsx'
import { MM } from './scene.tsx'

/** The dev-only switch that draws the bottle in plain grey, for judging its form. */
export const CLAY =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('clay')

/** Glass back faces, then the liquid, then anything inside it, then the glass front faces. */
export const RENDER_ORDER = { glassBack: 1, liquid: 2, particles: 3, glassFront: 4 } as const

/** Below this tilt from the bottle's axis, in radians, the bands sit at their upright levels. */
const UPRIGHT_TILT = 1e-3

const tiltOf = (u: THREE.Vector3) => Math.acos(Math.min(1, Math.max(-1, u.z / u.length())))

/** Each band's top for the surface's up `u` (in the bottle's mm frame), into `out` once tipped; the table is only asked for then. */
export function liquidLevels(
  u: THREE.Vector3,
  upright: number[],
  table: () => LevelTable,
  out?: number[],
): number[] {
  const tilt = tiltOf(u)
  return tilt < UPRIGHT_TILT ? upright : levelsAt(table(), tilt, out)
}

/** The liquid's lowest point along `u`: the mesh's floor upright, the table's once tipped. */
export function liquidFloor(u: THREE.Vector3, upright: number, table: () => LevelTable): number {
  const tilt = tiltOf(u)
  return tilt < UPRIGHT_TILT ? upright : floorAt(table(), tilt)
}

const UP = new THREE.Vector3(0, 1, 0)
const unturn = new THREE.Quaternion()

/** `u` in the bottle's frame: `normal` (default +y), a direction in the up frame turned by `frame`, seen from a bottle turned by `bottle`. */
export function surfaceUp(
  out: THREE.Vector3,
  bottle: THREE.Quaternion,
  frame: THREE.Quaternion,
  normal: THREE.Vector3 = UP,
): THREE.Vector3 {
  return out
    .copy(normal)
    .normalize()
    .applyQuaternion(frame)
    .applyQuaternion(unturn.copy(bottle).invert())
}

/** The scratch the liquid's draw reuses every frame, and its level table on demand. */
export interface LiquidWork {
  u: THREE.Vector3
  bottle: THREE.Quaternion
  up: THREE.Quaternion
  at: THREE.Vector3
  scale: THREE.Vector3
  /** The band tops once tipped. */
  levels: number[]
  /** The liquid's lowest point along `u`. */
  floor: number
  table: () => LevelTable
}

/**
 * Each band's top for `liquid` as posed now, leaving its up in `work.u` and its floor along that
 * up in `work.floor`: its turn against `upFrom`'s (or the scene's), `surfaceNormal` read in that frame.
 */
export function liquidTops(
  liquid: THREE.Object3D,
  s: Pick<PotionMeshProps, 'levels' | 'surfaceNormal' | 'upFrom'> & {
    built: { upright: number[]; floor: number }
  },
  work: LiquidWork,
): number[] {
  const from = s.upFrom?.current
  liquid.matrixWorld.decompose(work.at, work.bottle, work.scale)
  if (from) from.matrixWorld.decompose(work.at, work.up, work.scale)
  else work.up.identity()
  const u = surfaceUp(work.u, work.bottle, work.up, s.surfaceNormal)
  work.floor = liquidFloor(u, s.built.floor, work.table)
  return s.levels ?? liquidLevels(u, s.built.upright, work.table, work.levels)
}

/** How mixed the liquid is drawn, how strongly its vortex winds and how far that has turned (`Liquid.setMix`). */
export interface LiquidMix {
  mix: number
  swirl: number
  spin: number
}

const LAYERED: LiquidMix = { mix: 0, swirl: 0, spin: 0 }
const MIXED: LiquidMix = { mix: 1, swirl: 0, spin: 0 }

/** The mix as drawn: a show's while one is given, else the spec's at rest. */
export function mixDrawn(
  spec: Pick<PotionSpec, 'mixed'>,
  show?: { readonly current: LiquidMix },
): LiquidMix {
  return show ? show.current : spec.mixed ? MIXED : LAYERED
}

/** Whether two specs ask for one build: the same bottle holding the same liquid, whatever `mixed` says. */
export function sameBuild(a: PotionSpec, b: PotionSpec): boolean {
  return (
    a === b || JSON.stringify({ ...a, mixed: false }) === JSON.stringify({ ...b, mixed: false })
  )
}

/** The spec a built bottle is drawn as: the latest while it asks for this build, else as last shown, so `mixed` neither waits for a rebuild nor runs ahead of one. */
export function shownSpec(shown: PotionSpec, built: PotionSpec, latest: PotionSpec): PotionSpec {
  if (sameBuild(built, latest)) return latest
  return sameBuild(built, shown) ? shown : built
}

/** The one liquid a spec's layers mix into, once three are in. */
export function mixLook({ mix }: Pick<PotionSpec, 'mix'>): LayerLook | null {
  return mix ? { colour: mix.colour, trait: mix.trait, ingredient: mix.main } : null
}

type Held = number | { readonly current: number }
const held = (v: Held) => (typeof v === 'number' ? v : v.current)

/** Draws the stopper `lift` mm up its axis, turned `turn` radians about it. */
export function poseStopper(stopper: THREE.Object3D, lift: Held, turn: Held = 0): void {
  const z = held(lift)
  const about = held(turn)
  if (stopper.position.z === z && stopper.rotation.z === about) return
  stopper.position.z = z
  stopper.rotation.z = about
  stopper.updateMatrixWorld()
}

export interface PotionGeometries {
  glass: THREE.BufferGeometry
  liquid: THREE.BufferGeometry
  stopper: THREE.BufferGeometry
  label: THREE.BufferGeometry | null
}

/** The four parts' geometries, refilling `previous`'s buffers wherever the sizes match. */
export function fillGeometries(
  previous: PotionGeometries | null,
  parts: PotionParts,
  tag = false,
): PotionGeometries {
  const label = parts.label
    ? fillGeometry(previous?.label ?? null, parts.label, {
        aPaper: { array: paperMask(parts.label, tag), size: 1 },
      })
    : null
  if (!parts.label) previous?.label?.dispose()
  return {
    glass: fillGeometry(previous?.glass ?? null, parts.glass),
    liquid: fillGeometry(previous?.liquid ?? null, parts.liquid),
    stopper: fillGeometry(previous?.stopper ?? null, parts.stopper),
    label,
  }
}

interface Built {
  spec: PotionSpec
  parts: PotionParts
  upright: number[]
  /** The liquid mesh's floor, upright. */
  floor: number
  /** Built with the mesh for a bottle that tips, so the first lean costs nothing. */
  table: LevelTable | null
  motes: MotePool
  cavity: CavityRadii
}

function buildAll({ spec, tips }: { spec: PotionSpec; tips: boolean }): Built {
  const parts = buildPotionMesh(spec)
  const profile = bottleProfile(spec)
  return {
    spec,
    parts,
    upright: bandTops(profile, spec.layers.length),
    floor: heightRange(parts.liquid)[0],
    table: tips ? levelTable(spec) : null,
    motes: motePool(profile),
    cavity: cavityRadii(profile, MOTE_RADII, LIQUID_GAP_MM),
  }
}

/** The mesh for `spec`: built at once the first time, then at most once a frame, from the latest spec that asks for another build. */
function usePotionBuild(spec: PotionSpec, tips: boolean): Built {
  const [built, setBuilt] = useState(() => buildAll({ spec, tips }))
  const [builder] = useState(() => latestOnly(buildAll, setBuilt))
  useEffect(() => {
    if (!sameBuild(built.spec, spec) || (tips && !built.table)) builder.request({ spec, tips })
  }, [spec, tips, built, builder])
  useEffect(() => () => builder.cancel(), [builder])
  return built
}

function useGeometries(built: Built): PotionGeometries {
  const held = useRef<PotionGeometries | null>(null)
  const geometries = useMemo(
    () => (held.current = fillGeometries(held.current, built.parts, built.spec.label === 'tag')),
    [built],
  )
  useEffect(
    () => () => {
      const g = held.current
      for (const part of [g?.glass, g?.liquid, g?.stopper, g?.label]) part?.dispose()
    },
    [],
  )
  return geometries
}

const grey = (v: number) => new THREE.Color().setRGB(v, v, v, THREE.SRGBColorSpace)

/** Bottom band to top: light to darker, so each pour's line shows; all lighter than the stopper and label. */
const BAND_GREYS = [0.94, 0.79, 0.64, 0.5]
const SOLID_GREY = 0.34

function liquidUniforms() {
  return {
    uUp: { value: new THREE.Vector3(0, 0, 1) },
    uLevels: { value: new Array<number>(MAX_POURS).fill(0) },
    uCount: { value: 0 },
    uGreys: { value: BAND_GREYS.map(grey) },
  }
}
type LiquidUniforms = ReturnType<typeof liquidUniforms>

/** The liquid cut at its surface, banded by the plane dot(p, u) = h; the far wall's back faces show as the surface. */
function clayLiquid(uniforms: LiquidUniforms): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ roughness: 0.55, side: THREE.DoubleSide })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uUp;
varying vec3 vBottle;
varying vec3 vUpView;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vBottle = position;
vUpView = normalize(normalMatrix * uUp);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uUp;
uniform float uLevels[${MAX_POURS}];
uniform int uCount;
uniform vec3 uGreys[${MAX_POURS}];
varying vec3 vBottle;
varying vec3 vUpView;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float h = dot(vBottle, uUp);
if (uCount == 0 || h > uLevels[uCount - 1]) discard;
int band = gl_FrontFacing ? 0 : uCount - 1;
for (int i = 0; i < ${MAX_POURS - 1}; i++)
  if (gl_FrontFacing && i < uCount - 1 && h > uLevels[i]) band = i + 1;
diffuseColor.rgb = uGreys[band];`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (!gl_FrontFacing) normal = vUpView;`,
      )
  }
  return material
}

function clayMaterials(uniforms: LiquidUniforms) {
  const glass = (side: THREE.Side) =>
    new THREE.MeshStandardMaterial({
      color: grey(0.62),
      roughness: 0.3,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side,
    })
  const solid = new THREE.MeshStandardMaterial({ color: grey(SOLID_GREY), roughness: 0.8 })
  return {
    glassBack: glass(THREE.BackSide),
    glassFront: glass(THREE.FrontSide),
    liquid: clayLiquid(uniforms),
    stopper: solid,
    label: solid,
  }
}

export interface PotionMeshProps {
  spec: PotionSpec
  /** How far the stopper is drawn up out of the bore along the axis, mm; 0 seated. A `{ current }` holder is read as the stopper is drawn, so it can move with no render. */
  stopperLift?: number | { readonly current: number }
  /** The stopper's turn about the axis, radians; a number or a holder, as its lift. */
  stopperTurn?: number | { readonly current: number }
  /** A show's mix, read as the liquid is drawn. By default, the spec's at rest: its layers, or the mix once mixed. */
  mix?: { readonly current: LiquidMix }
  /** The spec as the page last rendered it, read as the liquid is drawn: the canvas renders a task behind the page. By default, `spec`. */
  latest?: { readonly current: PotionSpec }
  /** Each band's top `h`, mm, bottom first; read every frame. By default, the levels for the surface's up. */
  levels?: number[]
  /** The surface's up as a direction in the up frame (`upFrom`, or the scene); read every frame. By default, +y: level. */
  surfaceNormal?: THREE.Vector3
  /** The up frame: an object whose +y is up for the surface, read as the liquid is drawn. By default, the scene. A bottle given one may tip, so its level table is built with its mesh. */
  upFrom?: RefObject<THREE.Object3D | null>
  /** The liquid's clock; without one the liquid stands at time 0. */
  clock?: LiquidClock
  /** What the label says, and whether it is a secret blend's gold paper. */
  label?: { name: string; gold: boolean }
}

/** Glass far half, then the liquid's surface and body, then anything inside it, then the glass near half. */
const ORDER = {
  farTint: RENDER_ORDER.glassBack,
  farLight: RENDER_ORDER.glassBack + 0.1,
  surface: RENDER_ORDER.liquid,
  body: RENDER_ORDER.liquid + 0.1,
  nearTint: RENDER_ORDER.glassFront,
  nearLight: RENDER_ORDER.glassFront + 0.1,
}

/** The eye in `object`'s own frame: the bottle's millimetres. */
function eyeIn(object: THREE.Object3D, camera: THREE.Camera, out: THREE.Vector3) {
  return object.worldToLocal(out.setFromMatrixPosition(camera.matrixWorld))
}

const heightRange = (part: { attrs: Record<string, Float32Array> }): [number, number] => {
  let lo = Infinity
  let hi = -Infinity
  for (const z of part.attrs.aHeight!) {
    lo = Math.min(lo, z)
    hi = Math.max(hi, z)
  }
  return [lo, hi]
}

function useDisposed<T extends { dispose(): void } | null>(value: T): T {
  useEffect(() => () => value?.dispose(), [value])
  return value
}

/** The label's canvas, drawn again whenever what it says, its paper or its shape changes. */
function useLabelInk(spec: PotionSpec, part: PotionParts['label'], name: string, gold: boolean) {
  const [canvas] = useState(() => document.createElement('canvas'))
  const texture = useDisposed(
    useMemo(() => {
      const t = new THREE.CanvasTexture(canvas)
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    }, [canvas]),
  )
  const plain = useDisposed(useMemo(() => labelMaterial(texture, PAPERS.plain), [texture]))
  const gilt = useDisposed(useMemo(() => labelMaterial(texture, PAPERS.gold), [texture]))
  const area = part ? labelArea(part) : null
  const [halfWidth, halfHeight] = [area?.halfWidth ?? 0, area?.halfHeight ?? 0]
  useEffect(() => {
    const look = LABEL_LOOKS[spec.label]
    if (!look || halfWidth === 0) return
    let live = true
    const draw = () => {
      drawLabel(canvas, look, { halfWidth, halfHeight }, name, gold)
      texture.repeat.set(1 / (2 * halfWidth), 1 / (2 * halfHeight))
      texture.offset.set(0.5, 0.5)
      texture.needsUpdate = true
    }
    draw()
    const font = '64px "IM Fell English"'
    if (!document.fonts?.check(font)) void document.fonts?.load(font).then(() => live && draw())
    return () => {
      live = false
    }
  }, [canvas, texture, spec.label, halfWidth, halfHeight, name, gold])
  return gold ? gilt : plain
}

function useGlassLook(spec: PotionSpec, built: Built) {
  const look = GLASS_LOOKS[spec.glass]
  const glass = useDisposed(useMemo(() => createGlass(look), [look]))
  const stopperGlass = useDisposed(
    useMemo(
      () => (spec.stopper === 'glass' ? createGlass(STOPPER_GLASS(look)) : null),
      [spec.stopper, look],
    ),
  )
  const liquid = useDisposed(useMemo(createLiquid, []))
  const motes = useDisposed(useMemo(() => createMotes(liquid.uniforms), [liquid]))
  const corkMap = useDisposed(useMemo(corkTexture, []))
  const cork = useDisposed(useMemo(() => corkMaterial(corkMap), [corkMap]))

  const top = useMemo(() => heightRange(built.parts.liquid)[1], [built])
  useLayoutEffect(() => {
    liquid.setLayers(built.spec.layers)
    liquid.setMixed(mixLook(built.spec))
    motes.setLayers(built.spec.layers)
    motes.setMixed(mixLook(built.spec))
    motes.setCavity(built.cavity)
  }, [liquid, motes, built])
  useLayoutEffect(() => {
    const u = liquid.uniforms
    const middle = new THREE.Vector3(0, (top / 2) * MM, 0)
    u.uKeyDir.value.copy(CANDLE_AT).sub(middle).normalize()
    const key = new THREE.Color(LAMPS.candle.colour)
    u.uKeyColour.value.set(key.r, key.g, key.b)
    u.uBackDir.value.copy(middle).sub(MOON_AT).normalize()
    const moon = new THREE.Color(LAMPS.moon.colour).multiplyScalar(LAMPS.through)
    u.uBackColour.value.set(moon.r, moon.g, moon.b)
    u.uSelf.value = LIQUID.self
  }, [liquid, top])

  return { glass, stopperGlass, liquid, motes, cork }
}

/**
 * The bottle standing along +y, centred on its own middle, label towards +z (ADR 0105): the same
 * in the box stage and in the close look, which place it.
 */
export function PotionMesh(props: PotionMeshProps) {
  return CLAY ? <ClayBottle {...props} /> : <GlassBottle {...props} />
}

/** The per-frame surface: each band's top for the bottle as posed, the stopper's pose and the liquid's mix. */
function useSurface(props: PotionMeshProps, built: Built) {
  const { levels, surfaceNormal, upFrom, stopperLift = 0, stopperTurn = 0, mix } = props
  const surface = useRef({ built, levels, surfaceNormal, upFrom, stopperLift, stopperTurn, mix })
  surface.current = { built, levels, surfaceNormal, upFrom, stopperLift, stopperTurn, mix }
  const page = useRef({ spec: props.spec, latest: props.latest })
  page.current = { spec: props.spec, latest: props.latest }
  const shown = useRef({ spec: built.spec, built: built.spec, latest: built.spec })
  const work = useMemo(() => {
    const lazy = { spec: null as PotionSpec | null, table: null as LevelTable | null }
    return {
      u: new THREE.Vector3(),
      bottle: new THREE.Quaternion(),
      up: new THREE.Quaternion(),
      at: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      levels: [] as number[],
      floor: 0,
      table: (): LevelTable => {
        const b = surface.current.built
        if (b.table) return b.table
        if (lazy.spec !== b.spec) {
          lazy.spec = b.spec
          lazy.table = levelTable(b.spec)
        }
        return lazy.table!
      },
    }
  }, [])
  const tops = (liquid: THREE.Object3D) => liquidTops(liquid, surface.current, work)
  const drawStopper = (stopper: THREE.Object3D) =>
    poseStopper(stopper, surface.current.stopperLift, surface.current.stopperTurn)
  const mixNow = () => {
    const { built, mix } = surface.current
    const latest = page.current.latest?.current ?? page.current.spec
    const was = shown.current
    if (was.built !== built.spec || was.latest !== latest)
      shown.current = { spec: shownSpec(was.spec, built.spec, latest), built: built.spec, latest }
    return mixDrawn(shown.current.spec, mix)
  }
  return { work, tops, drawStopper, mixNow }
}

type BeforeRender = THREE.Object3D['onBeforeRender']

function GlassBottle(props: PotionMeshProps) {
  const { spec, upFrom, clock } = props
  const built = usePotionBuild(spec, upFrom !== undefined)
  const geometries = useGeometries(built)
  const shown = built.spec
  const look = useGlassLook(shown, built)
  const paper = useLabelInk(
    shown,
    built.parts.label,
    props.label?.name ?? '',
    props.label?.gold ?? false,
  )
  const { work, tops, drawStopper, mixNow } = useSurface(props, built)
  useFrame(() => {
    look.liquid.uniforms.uTime.value = clock?.time ?? 0
  })

  const { glass, stopperGlass, liquid } = look
  const liquidSurface: BeforeRender = function (this: THREE.Object3D, _r, _s, camera) {
    const levels = tops(this)
    liquid.setSurface(work.u, levels, work.floor)
    const { mix, swirl, spin } = mixNow()
    liquid.setMix(mix, swirl, spin)
    eyeIn(this, camera, liquid.uniforms.uEye.value)
  }
  const stopperPose: BeforeRender = function (this: THREE.Object3D) {
    drawStopper(this)
  }
  const stopperMaterials: [THREE.Material, number][] = stopperGlass
    ? [
        [stopperGlass.farTint, ORDER.farTint],
        [stopperGlass.farLight, ORDER.farLight],
        [stopperGlass.nearTint, ORDER.nearTint],
        [stopperGlass.nearLight, ORDER.nearLight],
      ]
    : [[look.cork, 0]]

  return (
    <group position={[0, (-shown.heightMm * MM) / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={MM}>
      <group name="glass">
        <mesh geometry={geometries.glass} material={glass.farTint} renderOrder={ORDER.farTint} />
        <mesh geometry={geometries.glass} material={glass.farLight} renderOrder={ORDER.farLight} />
        <mesh geometry={geometries.glass} material={glass.nearTint} renderOrder={ORDER.nearTint} />
        <mesh
          geometry={geometries.glass}
          material={glass.nearLight}
          renderOrder={ORDER.nearLight}
        />
      </group>
      <group name="liquid" visible={shown.layers.length > 0}>
        <mesh
          geometry={geometries.liquid}
          material={liquid.surface}
          renderOrder={ORDER.surface}
          onBeforeRender={liquidSurface}
        />
        <mesh geometry={geometries.liquid} material={liquid.body} renderOrder={ORDER.body} />
        <LiquidMotes motes={look.motes} pool={built.motes} renderOrder={RENDER_ORDER.particles} />
      </group>
      <group name="stopper">
        {stopperMaterials.map(([material, order], i) => (
          <mesh
            key={`${shown.stopper}-${i}`}
            geometry={geometries.stopper}
            material={material}
            renderOrder={order}
            onBeforeRender={stopperPose}
          />
        ))}
      </group>
      <group name="label">
        {geometries.label && <mesh geometry={geometries.label} material={paper} />}
      </group>
    </group>
  )
}

function ClayBottle(props: PotionMeshProps) {
  const { spec, upFrom } = props
  const built = usePotionBuild(spec, upFrom !== undefined)
  const geometries = useGeometries(built)
  const shown = built.spec
  const uniforms = useMemo(liquidUniforms, [])
  const materials = useMemo(() => clayMaterials(uniforms), [uniforms])
  useEffect(
    () => () => {
      for (const m of new Set(Object.values(materials))) m.dispose()
    },
    [materials],
  )
  const { work, tops, drawStopper } = useSurface(props, built)
  const drawLiquid: BeforeRender = function (this: THREE.Object3D) {
    const levels = tops(this)
    uniforms.uUp.value.copy(work.u)
    uniforms.uCount.value = Math.min(levels.length, MAX_POURS)
    for (let i = 0; i < uniforms.uCount.value; i++) uniforms.uLevels.value[i] = levels[i]!
  }
  const stopperPose: BeforeRender = function (this: THREE.Object3D) {
    drawStopper(this)
  }

  return (
    <group position={[0, (-shown.heightMm * MM) / 2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={MM}>
      <group name="glass">
        <mesh
          geometry={geometries.glass}
          material={materials.glassBack}
          renderOrder={RENDER_ORDER.glassBack}
        />
        <mesh
          geometry={geometries.glass}
          material={materials.glassFront}
          renderOrder={RENDER_ORDER.glassFront}
        />
      </group>
      <group name="liquid">
        <mesh
          geometry={geometries.liquid}
          material={materials.liquid}
          renderOrder={RENDER_ORDER.liquid}
          visible={shown.layers.length > 0}
          onBeforeRender={drawLiquid}
        />
      </group>
      <group name="stopper">
        <mesh
          geometry={geometries.stopper}
          material={materials.stopper}
          onBeforeRender={stopperPose}
        />
      </group>
      <group name="label">
        {geometries.label && <mesh geometry={geometries.label} material={materials.label} />}
      </group>
    </group>
  )
}
