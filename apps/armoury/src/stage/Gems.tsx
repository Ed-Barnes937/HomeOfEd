import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

import type { WandSpec } from '../wand/compile.ts'
import { gemPoses } from '../wand/geometry.ts'
import { gemGlow, GEM_REST } from './gemGlow.ts'

const UP = new THREE.Vector3(0, 1, 0)

/** A cut stone round the y axis, girdle at y = 0: a pointed pavilion below, a flat-topped crown above. */
function stoneGeometry() {
  const outline = [
    [0, -0.55],
    [1, 0],
    [0.96, 0.14],
    [0.62, 0.42],
    [0, 0.42],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(outline, 8)
}

/** A hexagonal crystal standing on y = 0, its base sunk in the cup, with a pointed top. */
function crystalGeometry(radius: number, length: number) {
  const point = 1.8 * radius
  const outline = [
    [0, 0],
    [0.85 * radius, 0],
    [radius, 1.5],
    [radius, length - point],
    [0, length],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  return new THREE.LatheGeometry(outline, 6)
}

/** Glass in the core's colour that lights from within; `uGemCap` limits how bright any of it gets. */
function gemMaterial(colour: string, cap: THREE.IUniform<number>, faceted: boolean) {
  const core = new THREE.Color(colour)
  const material = new THREE.MeshPhysicalMaterial({
    color: core.clone().multiplyScalar(0.25),
    emissive: core,
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
  const materials = useMemo(
    () => ({
      faceted: gemMaterial(spec.spell, cap, true),
      smooth: gemMaterial(spec.spell, cap, false),
    }),
    [spec.spell, cap],
  )
  useEffect(
    () => () => {
      materials.faceted.dispose()
      materials.smooth.dispose()
    },
    [materials],
  )

  const stone = useMemo(stoneGeometry, [])
  const crystal = useMemo(
    () =>
      spec.crystal ? crystalGeometry(spec.crystal.radius, spec.lengthMm - spec.crystal.from) : null,
    [spec.crystal, spec.lengthMm],
  )
  useEffect(() => () => stone.dispose(), [stone])
  useEffect(() => () => crystal?.dispose(), [crystal])

  const poses = useMemo(
    () =>
      gemPoses(spec).map(({ position, normal, radius }) => ({
        position,
        radius,
        quaternion: new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...normal)),
      })),
    [spec],
  )

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
      {spec.crystal && crystal && (
        <mesh
          geometry={crystal}
          material={materials.faceted}
          position={[0, 0, spec.crystal.from]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      )}
      {spec.orb && (
        <mesh material={materials.smooth} position={[0, 0, spec.orb.centre]}>
          <sphereGeometry args={[spec.orb.radius, 48, 32]} />
        </mesh>
      )}
    </>
  )
}
