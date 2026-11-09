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
const WOODS: Record<string, { grainAcross: boolean; tint: string; grain: number }> = {
  walnut: { grainAcross: true, tint: '#8a6656', grain: 2.1 },
  cherry: { grainAcross: true, tint: '#a08a88', grain: 3.2 },
  oak: { grainAcross: false, tint: '#f6ead8', grain: 2.1 },
  maple: { grainAcross: true, tint: '#ffffff', grain: 2.1 },
}
const WOOD_KEYS = Object.keys(WOODS)
const texturePaths = WOOD_KEYS.flatMap((w) => [
  `/textures/${w}-colour.webp`,
  `/textures/${w}-rough.webp`,
])

const LUMA = new THREE.Vector3(0.2126, 0.7152, 0.0722)

function meanLuminance(texture: THREE.Texture, tint: string): number {
  const size = 32
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return 0.25
  ctx.drawImage(texture.image as CanvasImageSource, 0, 0, size, size)
  const px = ctx.getImageData(0, 0, size, size).data
  const t = new THREE.Color(tint)
  const c = new THREE.Color()
  let sum = 0
  for (let i = 0; i < px.length; i += 4) {
    c.setRGB(px[i]! / 255, px[i + 1]! / 255, px[i + 2]! / 255, THREE.SRGBColorSpace).multiply(t)
    sum += c.r * LUMA.x + c.g * LUMA.y + c.b * LUMA.z
  }
  return sum / (size * size)
}

// Stain blends each pixel towards one target colour, scaled by its grain's
// lightness relative to the wood's mean, so a finish reads the same on every wood.
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
      uniform vec3 uStainColour;
      uniform float uWoodLum;
      uniform float uGrain;
      varying float vStain;
      varying float vShade;`,
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      float grain = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / uWoodLum, 0.05, 3.0);
      float boosted = pow(grain, uGrain);
      vec3 wood = diffuseColor.rgb * (boosted / grain);
      vec3 stained = uStainColour * clamp(boosted, 0.0, 3.0);
      diffuseColor.rgb = mix(wood, stained, vStain) * vShade;`,
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
      uStainColour: { value: new THREE.Color() },
      uWoodLum: { value: 0.25 },
      uGrain: { value: 2 },
    }),
    [],
  )

  const wood = WOODS[spec.wood] ?? WOODS.oak!
  const [map, roughnessMap] = useMemo(() => {
    const i = Math.max(0, WOOD_KEYS.indexOf(spec.wood)) * 2
    const pair = [textures[i]!, textures[i + 1]!] as const
    for (const t of pair) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.center.set(0.5, 0.5)
      t.rotation = wood.grainAcross ? Math.PI / 2 : 0
      t.anisotropy = 8
    }
    pair[0].colorSpace = THREE.SRGBColorSpace
    return pair
  }, [textures, spec.wood, wood.grainAcross])

  const woodLum = useMemo(() => meanLuminance(map, wood.tint), [map, wood.tint])
  useLayoutEffect(() => {
    stainUniforms.uWoodLum.value = woodLum
    stainUniforms.uGrain.value = wood.grain
    if (spec.stain.colour) stainUniforms.uStainColour.value.setRGB(...spec.stain.colour)
  }, [stainUniforms, woodLum, wood.grain, spec.stain.colour])

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
    const flare = sinceCast < SPELL_SECONDS ? Math.exp(-3 * sinceCast) : 0
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
