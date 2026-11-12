import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { WandSpec } from '../wand/compile.ts'
import { buildWandMesh, tipPose } from '../wand/geometry.ts'
import { Gems } from './Gems.tsx'
import { METALS } from './metals.ts'
import { MM } from './scene.tsx'
import { Sparkles } from './Sparkles.tsx'
import { SpellBurst } from './SpellBurst.tsx'
import { LONGEST_WAND_MM, SPELL_SECONDS, STAGE_FILL } from './stage.ts'
import {
  absorbance,
  addFinish,
  prepareWoodTextures,
  texturePaths,
  WOOD_KEYS,
  WOODS,
} from './woodFinish.ts'

export { prepareWoodTextures, texturePaths } from './woodFinish.ts'

/** The box stage's half width in scene units: the longest wand spans STAGE_FILL of it. */
export const BOX_HALF_WIDTH = (LONGEST_WAND_MM * MM) / 2 / STAGE_FILL

const ALONG = new THREE.Vector3(0, 0, 1)
/** The glow floats this far past the tip, in scene units. */
const TIP_GAP = 0.03

/** Where the tip glow sits in the wand group's own space, before it is turned to lie along x. */
export function tipPoint(spec: WandSpec): [number, number, number] {
  const { position: p, direction: d } = tipPose(spec)
  const half = (spec.lengthMm / 2) * MM
  return [p[0] * MM + d[0] * TIP_GAP, p[1] * MM + d[1] * TIP_GAP, p[2] * MM - half + d[2] * TIP_GAP]
}

const BONE = '#e6dbc2'

export function WandMesh({
  spec,
  castAt,
  reducedMotion,
}: {
  spec: WandSpec
  castAt: number | null
  reducedMotion: boolean
}) {
  const textures = useTexture(texturePaths)

  const geometry = useMemo(() => {
    const data = buildWandMesh(spec)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2))
    g.setAttribute('aStain', new THREE.BufferAttribute(data.stain, 1))
    g.setAttribute('aShade', new THREE.BufferAttribute(data.shade, 1))
    g.setAttribute('aZone', new THREE.BufferAttribute(data.zone, 3))
    g.setAttribute('aBark', new THREE.BufferAttribute(data.bark, 1))
    g.setIndex(new THREE.BufferAttribute(data.indices, 1))
    return g
  }, [spec])
  useEffect(() => () => geometry.dispose(), [geometry])

  const finishUniforms = useMemo(
    () => ({
      uStainAbsorb: { value: new THREE.Vector3() },
      uWoodLum: { value: 0.25 },
      uGrain: { value: 2 },
      uMetalColour: { value: new THREE.Color() },
      uMetalRough: { value: 0.3 },
      uMetalness: { value: 1 },
      uStainGloss: { value: 0.45 },
      uPaintColour: { value: new THREE.Color() },
      uBoneColour: { value: new THREE.Color(BONE) },
      uMatte: { value: 0 },
      uRoughMean: { value: 0.6 },
      uPores: { value: 0.5 },
      uSoak: { value: 1.2 },
      uBarkColour: { value: new THREE.Color() },
    }),
    [],
  )

  const wood = WOODS[spec.wood] ?? WOODS.oak!
  useMemo(() => prepareWoodTextures(textures), [textures])
  const woodIndex = Math.max(0, WOOD_KEYS.indexOf(spec.wood)) * 2
  const map = textures[woodIndex]!
  const roughnessMap = textures[woodIndex + 1]!

  const metal = METALS[spec.metal] ?? METALS.silver!
  const branch = spec.branch !== null
  useLayoutEffect(() => {
    finishUniforms.uWoodLum.value = wood.lum
    finishUniforms.uGrain.value = wood.grain
    if (spec.stain.colour)
      finishUniforms.uStainAbsorb.value.set(...absorbance(spec.stain.colour, branch))
    finishUniforms.uMetalColour.value.set(metal.colour)
    finishUniforms.uMetalRough.value = metal.roughness
    finishUniforms.uMetalness.value = metal.metalness
    finishUniforms.uPaintColour.value.setRGB(...spec.paint)
    // A stain polishes a turned wand's oil; a branch's raw-wood roughness ignores it.
    finishUniforms.uStainGloss.value = 0.45
    finishUniforms.uMatte.value = branch ? 1 : 0
    finishUniforms.uRoughMean.value = wood.rough
    finishUniforms.uPores.value = wood.pores * (branch ? 1 : 0.5)
    finishUniforms.uSoak.value = branch ? 1.8 : 1.2
    finishUniforms.uBarkColour.value.set(wood.bark)
  }, [finishUniforms, wood, spec.stain.colour, metal, spec.paint, branch])

  const half = (spec.lengthMm / 2) * MM
  // The spell leaves along the way the tip points, which on a branch leans off the chord.
  const tipTurn = useMemo(() => {
    const direction = new THREE.Vector3(...tipPose(spec).direction)
    return new THREE.Quaternion()
      .setFromUnitVectors(ALONG, direction)
      .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)))
  }, [spec])
  const tip = useMemo(() => tipPoint(spec), [spec])
  return (
    <group rotation={[0, Math.PI / 2, 0]}>
      <mesh geometry={geometry} position={[0, 0, -half]} scale={MM}>
        <meshStandardMaterial
          map={map}
          roughnessMap={roughnessMap}
          bumpMap={roughnessMap}
          bumpScale={0.8}
          roughness={0.62}
          envMapIntensity={0.8}
          color={wood.tint}
          onBeforeCompile={(shader) => addFinish(shader, finishUniforms)}
        />
      </mesh>
      <group position={[0, 0, -half]} scale={MM}>
        <Gems spec={spec} castAt={castAt} reducedMotion={reducedMotion} />
      </group>
      <group position={tip} quaternion={tipTurn}>
        <TipGlow colour={spec.spell} castAt={castAt} reducedMotion={reducedMotion} />
      </group>
    </group>
  )
}

function TipGlow({
  colour,
  castAt,
  reducedMotion,
}: {
  colour: string
  castAt: number | null
  reducedMotion: boolean
}) {
  const bright = useMemo(() => new THREE.Color(colour).multiplyScalar(6), [colour])
  const orb = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const sinceCast = castAt === null ? Infinity : clock.elapsedTime - castAt
    const flare = sinceCast >= 0 && sinceCast < SPELL_SECONDS ? Math.exp(-3 * sinceCast) : 0
    const pulse = reducedMotion ? 0 : 0.15 * Math.sin(clock.elapsedTime * 3)
    orb.current?.scale.setScalar(1 + pulse + 2.2 * flare)
    if (light.current) light.current.intensity = 0.6 + 5 * flare
  })
  return (
    <>
      <mesh ref={orb}>
        <sphereGeometry args={[0.025, 16, 16]} />
        <meshBasicMaterial color={bright} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={colour} intensity={0.6} distance={1.4} />
      {!reducedMotion && <Sparkles colour={colour} />}
      {!reducedMotion && <SpellBurst colour={colour} castAt={castAt} />}
    </>
  )
}
