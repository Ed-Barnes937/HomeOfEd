import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import * as THREE from 'three'

import type { PotionSpec } from '../potion/compile.ts'
import { buildPotionMesh, type PotionMesh as PotionParts } from '../potion/geometry.ts'
import { uprightLevels } from '../potion/profile.ts'
import { levelsAt, levelTable, type LevelTable } from '../potion/tipped.ts'
import { MAX_POURS } from '../potion/potionSchema.ts'
import type { MeshPart } from '../sword/sweep.ts'
import { MM } from './scene.tsx'

/** The dev-only switch that draws the bottle in plain grey; until the real look exists, every bottle is clay. */
export const CLAY =
  import.meta.env.DEV &&
  typeof location !== 'undefined' &&
  new URLSearchParams(location.search).has('clay')

/** Glass back faces, then the liquid, then anything inside it, then the glass front faces. */
export const RENDER_ORDER = { glassBack: 1, liquid: 2, particles: 3, glassFront: 4 } as const

/** Below this tilt from the bottle's axis, in radians, the bands sit at their upright levels. */
const UPRIGHT_TILT = 1e-3

/** Each band's top for the surface's up `u` (in the bottle's mm frame); the table is only built once tipped. */
export function liquidLevels(
  u: THREE.Vector3,
  upright: number[],
  table: () => LevelTable,
): number[] {
  const tilt = Math.acos(Math.min(1, Math.max(-1, u.z / u.length())))
  return tilt < UPRIGHT_TILT ? upright : levelsAt(table(), tilt)
}

export interface PotionGeometries {
  glass: THREE.BufferGeometry
  liquid: THREE.BufferGeometry
  stopper: THREE.BufferGeometry
  label: THREE.BufferGeometry | null
}

/** Copies a part into `geometry` when its buffers are the same size, else replaces it. */
function fillGeometry(geometry: THREE.BufferGeometry | null, part: MeshPart): THREE.BufferGeometry {
  const attrs: Record<string, { array: Float32Array; size: number }> = {
    position: { array: part.positions, size: 3 },
    normal: { array: part.normals, size: 3 },
    uv: { array: part.uvs, size: 2 },
    ...Object.fromEntries(Object.entries(part.attrs).map(([k, array]) => [k, { array, size: 1 }])),
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

/** The four parts' geometries, refilling `previous`'s buffers wherever the sizes match. */
export function fillGeometries(
  previous: PotionGeometries | null,
  parts: PotionParts,
): PotionGeometries {
  const label = parts.label ? fillGeometry(previous?.label ?? null, parts.label) : null
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
}

const buildAll = (spec: PotionSpec): Built => ({
  spec,
  parts: buildPotionMesh(spec),
  upright: uprightLevels(spec),
})

/** The mesh for `spec`: built at once the first time, then at most once a frame, from the latest spec. */
function usePotionBuild(spec: PotionSpec): Built {
  const [built, setBuilt] = useState(() => buildAll(spec))
  const latest = useRef(spec)
  latest.current = spec
  const frame = useRef<number | null>(null)
  useEffect(() => {
    if (built.spec === spec || frame.current !== null) return
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      setBuilt(buildAll(latest.current))
    })
  }, [spec, built.spec])
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    },
    [],
  )
  return built
}

function useGeometries(built: Built): PotionGeometries {
  const held = useRef<PotionGeometries | null>(null)
  const geometries = useMemo(
    () => (held.current = fillGeometries(held.current, built.parts)),
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
  /** How far the stopper is drawn up out of the bore along the axis, mm; 0 seated. */
  stopperLift?: number
  /** Each band's top `h`, mm, bottom first; read every frame. By default, the levels for the surface's up. */
  levels?: number[]
  /** `u`, the surface's up in the bottle's mm frame (foot centre, axis +z); read every frame. By default, the axis. */
  surfaceNormal?: THREE.Vector3
  /** An object whose +y is up for the surface, in place of `surfaceNormal`: read as the liquid is drawn. */
  upFrom?: RefObject<THREE.Object3D | null>
}

/**
 * The bottle standing along +y, centred on its own middle, label towards +z (ADR 0105): the same
 * in the box stage and in the close look, which place it.
 */
export function PotionMesh({
  spec,
  stopperLift = 0,
  levels,
  surfaceNormal,
  upFrom,
}: PotionMeshProps) {
  const built = usePotionBuild(spec)
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

  const liquidMesh = useRef<THREE.Mesh>(null)
  const table = useRef<{ spec: PotionSpec; table: LevelTable } | null>(null)
  const surface = useRef({ built, levels, surfaceNormal, upFrom })
  surface.current = { built, levels, surfaceNormal, upFrom }
  const work = useMemo(
    () => ({
      u: new THREE.Vector3(),
      bottle: new THREE.Quaternion(),
      up: new THREE.Quaternion(),
      at: new THREE.Vector3(),
      scale: new THREE.Vector3(),
    }),
    [],
  )

  const onBeforeRender = (liquid: THREE.Object3D) => {
    const s = surface.current
    const { u } = work
    const from = s.upFrom?.current
    if (from) {
      liquid.matrixWorld.decompose(work.at, work.bottle, work.scale)
      from.matrixWorld.decompose(work.at, work.up, work.scale)
      u.set(0, 1, 0).applyQuaternion(work.up).applyQuaternion(work.bottle.invert())
    } else if (s.surfaceNormal) u.copy(s.surfaceNormal).normalize()
    else u.set(0, 0, 1)
    const tops =
      s.levels ??
      liquidLevels(u, s.built.upright, () => {
        if (table.current?.spec !== s.built.spec)
          table.current = { spec: s.built.spec, table: levelTable(s.built.spec) }
        return table.current.table
      })
    uniforms.uUp.value.copy(u)
    uniforms.uCount.value = tops.length
    tops.forEach((h, i) => (uniforms.uLevels.value[i] = h))
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
          onBeforeRender={() => liquidMesh.current && onBeforeRender(liquidMesh.current)}
          ref={liquidMesh}
        />
      </group>
      <group name="stopper" position={[0, 0, stopperLift]}>
        <mesh geometry={geometries.stopper} material={materials.stopper} />
      </group>
      <group name="label">
        {geometries.label && <mesh geometry={geometries.label} material={materials.label} />}
      </group>
    </group>
  )
}
