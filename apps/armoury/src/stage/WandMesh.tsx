import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { WandSpec } from '../wand/compile.ts'
import { buildWandMesh } from '../wand/geometry.ts'
import { Sparkles } from './Sparkles.tsx'
import { SPELL_SECONDS, SpellBurst } from './SpellBurst.tsx'

/** Scene units per mm: a 33cm wand is 3.3 units long. */
export const MM = 0.01

// Poly Haven CC0 veneer scans. Some are photographed with the grain across the
// image, so they're turned to run along the wand. The tint stands in for oil.
// `grain` deepens the scan's light and dark so it survives at a distance.
// `lum` is the scan's mean linear luminance under its tint; re-measure it if either changes.
const WOODS: Record<string, { grainAcross: boolean; tint: string; grain: number; lum: number }> = {
  walnut: { grainAcross: true, tint: '#8a6656', grain: 2.1, lum: 0.0518 },
  cherry: { grainAcross: true, tint: '#a08a88', grain: 3.2, lum: 0.1388 },
  oak: { grainAcross: false, tint: '#f6ead8', grain: 2.1, lum: 0.2007 },
  maple: { grainAcross: true, tint: '#ffffff', grain: 2.1, lum: 0.6707 },
}
const WOOD_KEYS = Object.keys(WOODS)
export const texturePaths = WOOD_KEYS.flatMap((w) => [
  `/textures/${w}-colour.webp`,
  `/textures/${w}-rough.webp`,
])

// drei uploads every texture as it loads, and three never re-reads these settings
// after an upload, so each wood is set up here rather than when it's first chosen.
export function prepareWoodTextures(textures: THREE.Texture[]) {
  textures.forEach((t, i) => {
    const wood = WOODS[WOOD_KEYS[i >> 1]!]!
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.center.set(0.5, 0.5)
    t.rotation = wood.grainAcross ? Math.PI / 2 : 0
    t.anisotropy = 8
    if (i % 2 === 0) t.colorSpace = THREE.SRGBColorSpace
  })
}

// A full coat's absorbance, split into its hue (the swatch over its brightest
// channel) and its darkness, so a dye's colour survives on pale wood.
function absorbance(colour: [number, number, number]): [number, number, number] {
  const top = Math.max(...colour, 0.004)
  const darkness = -Math.log(top)
  return colour.map((c) => 1.2 * -Math.log(Math.max(c, 0.004) / top) + 0.45 * darkness) as [
    number,
    number,
    number,
  ]
}

// Stain is a translucent dye: it absorbs light (Beer-Lambert) rather than
// painting over the wood, soaks deeper into the darker open grain, and is oiled.
function addStain(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: Record<string, THREE.IUniform>,
) {
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      `#include <common>
      attribute float aStain;
      attribute float aShade;
      varying float vStain;
      varying float vShade;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStain = aStain;
      vShade = aShade;`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uStainAbsorb;
      uniform float uWoodLum;
      uniform float uGrain;
      varying float vStain;
      varying float vShade;`,
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      // Antialiasing can sample a varying outside its triangle, and the dye is exponential.
      float stain = clamp(vStain, 0.0, 1.0);
      float grain = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / uWoodLum, 0.05, 3.0);
      float boosted = pow(grain, uGrain);
      vec3 wood = diffuseColor.rgb * (boosted / grain);
      float soak = stain * clamp(2.2 - 1.2 * boosted, 0.3, 2.0);
      wood = mix(wood, vec3(dot(wood, vec3(0.2126, 0.7152, 0.0722))), 0.35 * stain);
      diffuseColor.rgb = wood * exp(-uStainAbsorb * soak) * clamp(vShade, 0.0, 1.0);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor *= 1.0 - 0.45 * clamp(vStain, 0.0, 1.0);`,
    )
}

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
    g.setIndex(new THREE.BufferAttribute(data.indices, 1))
    return g
  }, [spec])
  useEffect(() => () => geometry.dispose(), [geometry])

  const stainUniforms = useMemo(
    () => ({
      uStainAbsorb: { value: new THREE.Vector3() },
      uWoodLum: { value: 0.25 },
      uGrain: { value: 2 },
    }),
    [],
  )

  const wood = WOODS[spec.wood] ?? WOODS.oak!
  useMemo(() => prepareWoodTextures(textures), [textures])
  const woodIndex = Math.max(0, WOOD_KEYS.indexOf(spec.wood)) * 2
  const map = textures[woodIndex]!
  const roughnessMap = textures[woodIndex + 1]!

  useLayoutEffect(() => {
    stainUniforms.uWoodLum.value = wood.lum
    stainUniforms.uGrain.value = wood.grain
    if (spec.stain.colour) stainUniforms.uStainAbsorb.value.set(...absorbance(spec.stain.colour))
  }, [stainUniforms, wood.lum, wood.grain, spec.stain.colour])

  const half = (spec.lengthMm / 2) * MM
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
          onBeforeCompile={(shader) => addStain(shader, stainUniforms)}
        />
      </mesh>
      <group position={[0, 0, half + 0.03]} rotation={[0, -Math.PI / 2, 0]}>
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
