import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import type { WandSpec } from '../wand/compile.ts'
import { buildWandMesh, tipPose } from '../wand/geometry.ts'
import { Gems } from './Gems.tsx'
import { Sparkles } from './Sparkles.tsx'
import { SpellBurst } from './SpellBurst.tsx'
import { BLOOM_THRESHOLD, SPELL_SECONDS } from './stage.ts'

/** Scene units per mm: a 33cm wand is 3.3 units long. */
export const MM = 0.01
const ALONG = new THREE.Vector3(0, 0, 1)
/** The glow floats this far past the tip, in scene units. */
const TIP_GAP = 0.03

/** Where the tip glow sits in the wand group's own space, before it is turned to lie along x. */
export function tipPoint(spec: WandSpec): [number, number, number] {
  const { position: p, direction: d } = tipPose(spec)
  const half = (spec.lengthMm / 2) * MM
  return [p[0] * MM + d[0] * TIP_GAP, p[1] * MM + d[1] * TIP_GAP, p[2] * MM - half + d[2] * TIP_GAP]
}

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

const METALS: Record<string, { colour: string; roughness: number; metalness: number }> = {
  silver: { colour: '#efede8', roughness: 0.22, metalness: 1 },
  brass: { colour: '#d2b06a', roughness: 0.32, metalness: 1 },
  gold: { colour: '#f4bf52', roughness: 0.2, metalness: 1 },
  darkIron: { colour: '#5c5c60', roughness: 0.42, metalness: 0.85 },
}
const BONE = '#e6dbc2'
const texturePaths = WOOD_KEYS.flatMap((w) => [
  `/textures/${w}-colour.webp`,
  `/textures/${w}-rough.webp`,
])

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
// Metal, paint and bone zones are mixed over the wood by their per-vertex weights.
function addFinish(
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
      attribute vec3 aZone;
      varying float vStain;
      varying float vShade;
      varying vec3 vZone;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStain = aStain;
      vShade = aShade;
      vZone = aZone;`,
    )
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uStainAbsorb;
      uniform float uWoodLum;
      uniform float uGrain;
      uniform vec3 uMetalColour;
      uniform float uMetalRough;
      uniform float uMetalness;
      uniform float uStainGloss;
      uniform vec3 uPaintColour;
      uniform vec3 uBoneColour;
      varying float vStain;
      varying float vShade;
      varying vec3 vZone;
      vec4 zoneWeights() {
        vec3 z = clamp(vZone, 0.0, 1.0);
        return vec4(z, max(0.0, 1.0 - z.x - z.y - z.z));
      }
      float zoneBump() {
        vec4 z = zoneWeights();
        return z.w + 0.3 * z.y + 0.2 * z.z;
      }`,
    )
    .replace(
      '#include <bumpmap_pars_fragment>',
      THREE.ShaderChunk.bumpmap_pars_fragment.replaceAll('bumpScale *', 'bumpScale * zoneBump() *'),
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
      vec4 zone = zoneWeights();
      float shade = clamp(vShade, 0.0, 1.0);
      vec3 bone = uBoneColour * mix(1.0, clamp(grain, 0.6, 1.4), 0.25) * exp(-0.8 * stain * vec3(dot(uStainAbsorb, vec3(1.0 / 3.0))));
      diffuseColor.rgb = shade * (zone.w * wood * exp(-uStainAbsorb * soak)
        + zone.x * uMetalColour + zone.y * uPaintColour + zone.z * bone);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor *= 1.0 - uStainGloss * clamp(vStain, 0.0, 1.0);
      roughnessFactor = zone.w * roughnessFactor + zone.x * uMetalRough + zone.y * 0.22 + zone.z * 0.5;`,
    )
    .replace(
      '#include <metalnessmap_fragment>',
      `#include <metalnessmap_fragment>
      metalnessFactor = mix(metalnessFactor, uMetalness, zone.x);`,
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance += 0.05 * zone.z * uBoneColour;`,
    )
    .replace(
      '#include <opaque_fragment>',
      `outgoingLight *= min(1.0, ${(0.92 * BLOOM_THRESHOLD).toFixed(3)} / max(max(outgoingLight.r, outgoingLight.g), max(outgoingLight.b, 1e-4)));
      #include <opaque_fragment>`,
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
    g.setAttribute('aZone', new THREE.BufferAttribute(data.zone, 3))
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

  const metal = METALS[spec.metal] ?? METALS.silver!
  const branch = spec.branch !== null
  useLayoutEffect(() => {
    finishUniforms.uWoodLum.value = wood.lum
    finishUniforms.uGrain.value = wood.grain
    if (spec.stain.colour) finishUniforms.uStainAbsorb.value.set(...absorbance(spec.stain.colour))
    finishUniforms.uMetalColour.value.set(metal.colour)
    finishUniforms.uMetalRough.value = metal.roughness
    finishUniforms.uMetalness.value = metal.metalness
    finishUniforms.uPaintColour.value.setRGB(...spec.paint)
    // A stained branch keeps its bark-like sheen low; a turned wand is polished.
    finishUniforms.uStainGloss.value = branch ? 0.15 : 0.45
  }, [finishUniforms, wood.lum, wood.grain, spec.stain.colour, metal, spec.paint, branch])

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
          roughness={branch ? 0.72 : 0.62}
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
