import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import type { GemColour, WandSpec } from '../wand/compile.ts'
import { cutOutline, type GemCut } from '../wand/gems.ts'
import { crystalMesh, endPoses, gemPoses } from '../wand/geometry.ts'
import { gemGlow, GEM_REST } from './gemGlow.ts'

/** A cut stone with its girdle on y = 0: a pointed pavilion below, a flat-topped crown above; outline x across, z along. */
function stoneGeometry(cut: GemCut) {
  const outline = cutOutline(cut)
  const rows: [number, number][] = [
    [1, 0],
    [0.96, 0.14],
    [0.62, 0.42],
  ]
  const positions = [0, -0.55, 0, 0, 0.42, 0]
  for (const [scale, y] of rows)
    for (const [x, z] of outline) positions.push(scale * x, y, scale * z)
  const n = outline.length
  const at = (row: number, i: number) => 2 + row * n + (i % n)
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    indices.push(0, at(0, i), at(0, i + 1))
    for (let row = 0; row + 1 < rows.length; row++)
      indices.push(
        at(row, i),
        at(row + 1, i),
        at(row, i + 1),
        at(row, i + 1),
        at(row + 1, i),
        at(row + 1, i + 1),
      )
    indices.push(1, at(rows.length - 1, i + 1), at(rows.length - 1, i))
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function crystalGeometry(spec: WandSpec) {
  const solid = crystalMesh(spec)
  if (!solid) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(solid.positions, 3))
  geometry.setIndex(solid.indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Coloured glass that lights from within; `uGemCap` limits how bright any of it gets. */
function gemMaterial(colour: GemColour, cap: THREE.IUniform<number>, faceted: boolean) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colour.body),
    emissive: new THREE.Color(colour.glow),
    emissiveIntensity: GEM_REST.emissive,
    roughness: 0.12,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.6,
    flatShading: faceted,
  })
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uGemCap = cap
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGemCap;')
      .replace(
        '#include <emissivemap_fragment>',
        // Brightest where the stone faces the eye and dim towards its edges, so it reads as lit from inside.
        `#include <emissivemap_fragment>
        totalEmissiveRadiance *= mix(0.25, 1.4, pow(max(dot(normal, normalize(vViewPosition)), 0.0), 1.5));`,
      )
      .replace(
        '#include <opaque_fragment>',
        `outgoingLight *= min(1.0, uGemCap / max(max(outgoingLight.r, outgoingLight.g), max(outgoingLight.b, 1e-4)));
        #include <opaque_fragment>`,
      )
  }
  return material
}

export function Gems({
  spec,
  castAt,
  reducedMotion,
}: {
  spec: WandSpec
  castAt: number | null
  reducedMotion: boolean
}) {
  const cap = useMemo(() => ({ value: GEM_REST.cap }), [])
  const { glow, body } = spec.gemColour
  const materials = useMemo(
    () => ({
      faceted: gemMaterial({ glow, body }, cap, true),
      smooth: gemMaterial({ glow, body }, cap, false),
    }),
    [glow, body, cap],
  )
  useEffect(
    () => () => {
      materials.faceted.dispose()
      materials.smooth.dispose()
    },
    [materials],
  )

  const cut = spec.gems[0]?.cut ?? 'round'
  const stone = useMemo(() => stoneGeometry(cut), [cut])
  const crystal = useMemo(() => crystalGeometry(spec), [spec])
  useEffect(() => () => stone.dispose(), [stone])
  useEffect(() => () => crystal?.dispose(), [crystal])

  const poses = useMemo(
    () =>
      gemPoses(spec).map(({ position, normal, along, radius }) => {
        const y = new THREE.Vector3(...normal)
        const z = new THREE.Vector3(...along)
        const x = new THREE.Vector3().crossVectors(y, z)
        return {
          position,
          radius,
          quaternion: new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().makeBasis(x, y, z),
          ),
        }
      }),
    [spec],
  )
  const orb = useMemo(() => endPoses(spec).orb?.position, [spec])

  useFrame(({ clock }) => {
    const glow = gemGlow(castAt === null ? Infinity : clock.elapsedTime - castAt, reducedMotion)
    materials.faceted.emissiveIntensity = glow.emissive
    materials.smooth.emissiveIntensity = glow.emissive
    cap.value = glow.cap
  })

  return (
    <>
      {poses.map((pose, i) => (
        <mesh
          key={i}
          geometry={stone}
          material={materials.faceted}
          position={pose.position}
          quaternion={pose.quaternion}
          scale={pose.radius}
        />
      ))}
      {crystal && <mesh geometry={crystal} material={materials.faceted} />}
      {spec.orb && orb && (
        <mesh material={materials.smooth} position={orb}>
          <sphereGeometry args={[spec.orb.radius, 48, 32]} />
        </mesh>
      )}
    </>
  )
}
