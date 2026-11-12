import * as THREE from 'three'

import { BLOOM_THRESHOLD } from './stage.ts'

// Poly Haven CC0 veneer scans. Some are photographed with the grain across the
// image, so they're turned to run along the wand. The tint stands in for oil.
// `grain` deepens the scan's light and dark so it survives at a distance.
// `lum` is the scan's mean linear luminance under its tint, and `rough` its roughness
// map's mean; re-measure them if the scans or tints change. `pores` is how open the
// grain is: oak's pores show, maple's barely do.
export const WOODS: Record<
  string,
  {
    grainAcross: boolean
    tint: string
    grain: number
    lum: number
    rough: number
    pores: number
    bark: string
  }
> = {
  walnut: {
    grainAcross: true,
    tint: '#8a6656',
    grain: 2.1,
    lum: 0.0518,
    rough: 0.574,
    pores: 0.8,
    bark: '#3b322b',
  },
  cherry: {
    grainAcross: true,
    tint: '#a08a88',
    grain: 3.2,
    lum: 0.1388,
    rough: 0.698,
    pores: 0.5,
    bark: '#4a2e28',
  },
  oak: {
    grainAcross: false,
    tint: '#f6ead8',
    grain: 2.1,
    lum: 0.2007,
    rough: 0.531,
    pores: 1,
    bark: '#5a5047',
  },
  maple: {
    grainAcross: true,
    tint: '#ffffff',
    grain: 2.1,
    lum: 0.6707,
    rough: 0.769,
    pores: 0.35,
    bark: '#675d55',
  },
}
/** The mesh's UVs are this many mm per unit (buildWandMesh's default `textureMm`). */
const UV_MM = 110
// What pores and lenticels average to, so they fade to the same tone and soak when finer than a pixel.
const PORE_MEAN = 0.18
const LENTICEL_MEAN = 0.05
export const WOOD_KEYS = Object.keys(WOODS)
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
// Raw wood drinks more of it than oiled wood, so a branch takes a stronger coat.
export function absorbance(
  colour: [number, number, number],
  raw: boolean,
): [number, number, number] {
  const top = Math.max(...colour, 0.004)
  const darkness = -Math.log(top)
  const [hue, dark] = raw ? [1.6, 0.55] : [1.2, 0.45]
  return colour.map((c) => hue * -Math.log(Math.max(c, 0.004) / top) + dark * darkness) as [
    number,
    number,
    number,
  ]
}

// Stain is a translucent dye: it absorbs light (Beer-Lambert) rather than
// painting over the wood, and soaks deeper into the darker open grain and pores.
// A turned wand is oiled; a branch is raw wood, matte, its roughness following the
// grain, and may wear bark. Metal, paint and bone are mixed over the wood by their
// per-vertex weights.
export function addFinish(
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
      attribute float aBark;
      varying float vStain;
      varying float vShade;
      varying vec3 vZone;
      varying float vBark;
      varying vec2 vWandUv;`,
    )
    .replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStain = aStain;
      vShade = aShade;
      vZone = aZone;
      vBark = aBark;
      vWandUv = uv;`,
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
      uniform float uMatte;
      uniform float uRoughMean;
      uniform float uPores;
      uniform float uSoak;
      uniform vec3 uBarkColour;
      varying float vStain;
      varying float vShade;
      varying vec3 vZone;
      varying float vBark;
      varying vec2 vWandUv;
      vec4 zoneWeights() {
        vec3 z = clamp(vZone, 0.0, 1.0);
        return vec4(z, max(0.0, 1.0 - z.x - z.y - z.z));
      }
      float barkWeight() {
        return clamp(vBark, 0.0, 1.0);
      }
      float zoneBump() {
        vec4 z = zoneWeights();
        return z.w * (1.0 - 0.6 * barkWeight()) + 0.3 * z.y + 0.2 * z.z;
      }
      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
          mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // Detail finer than a pixel fades to its average rather than shimmering.
      float detail(vec2 p) {
        return 1.0 - smoothstep(0.35, 1.0, max(fwidth(p.x), fwidth(p.y)));
      }
      // Pores: short dark dashes along the grain, about 0.2 mm across. mm runs (around, along).
      float poreAt(vec2 mm) {
        vec2 p = mm * vec2(5.0, 0.45);
        return mix(${PORE_MEAN.toFixed(2)}, smoothstep(0.6, 0.85, vnoise(p)), detail(p));
      }
      // Fibres: fine light and dark streaks running with the grain, centred on 0.
      float fibreAt(vec2 mm) {
        vec2 p = mm * vec2(11.0, 0.22);
        return (vnoise(p) - 0.5) * detail(p);
      }
      // Bark's surface: stringy streaks along the wand, and lenticels, short pale dashes across it.
      float barkStreakAt(vec2 mm) {
        vec2 p = mm * vec2(2.2, 0.12);
        return mix(0.5, vnoise(p), detail(p));
      }
      float lenticelAt(vec2 mm) {
        vec2 p = mm * vec2(0.8, 2.5);
        return mix(${LENTICEL_MEAN.toFixed(2)}, smoothstep(0.8, 0.92, vnoise(p)), detail(p));
      }
      float barkHeightAt(vec2 mm) {
        return barkStreakAt(mm) - 0.5 + 0.6 * lenticelAt(mm);
      }
      float woodHeightAt(vec2 uv) {
        vec2 mm = uv * ${UV_MM.toFixed(1)};
        float wood = uPores * (0.6 * fibreAt(mm) - poreAt(mm));
        return mix(wood, 1.6 * barkHeightAt(mm), barkWeight());
      }`,
    )
    .replace(
      '#include <bumpmap_pars_fragment>',
      THREE.ShaderChunk.bumpmap_pars_fragment
        .replaceAll('bumpScale *', 'bumpScale * zoneBump() *')
        .replace(
          'return vec2( dBx, dBy );',
          `float h0 = woodHeightAt(vWandUv);
          float fine = mix(0.35, 0.6, barkWeight()) * zoneWeights().w;
          dBx += fine * (woodHeightAt(vWandUv + dFdx(vWandUv)) - h0);
          dBy += fine * (woodHeightAt(vWandUv + dFdy(vWandUv)) - h0);
          return vec2( dBx, dBy );`,
        ),
    )
    .replace(
      '#include <map_fragment>',
      `#include <map_fragment>
      // Antialiasing can sample a varying outside its triangle, and the dye is exponential.
      float stain = clamp(vStain, 0.0, 1.0);
      float grain = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) / uWoodLum, 0.05, 3.0);
      float boosted = pow(grain, uGrain);
      vec3 wood = diffuseColor.rgb * (boosted / grain);
      vec2 mm = vWandUv * ${UV_MM.toFixed(1)};
      float pore = uPores * poreAt(mm);
      float fibre = uPores * fibreAt(mm);
      wood *= (1.0 - 0.45 * pore) * (1.0 + 0.18 * fibre);
      // Open grain and pores drink more of the dye than the dense wood between them.
      float soak = stain * (clamp(1.0 + uSoak * (1.0 - boosted), 0.3, 0.8 + uSoak) + 1.2 * pore);
      wood = mix(wood, vec3(dot(wood, vec3(0.2126, 0.7152, 0.0722))), 0.35 * stain);
      vec4 zone = zoneWeights();
      float shade = clamp(vShade, 0.0, 1.0);
      float barkW = barkWeight();
      vec3 bark = uBarkColour * (0.6 + 0.7 * vnoise(mm * vec2(0.5, 0.1))) * (0.65 + 0.7 * barkStreakAt(mm));
      bark = mix(bark, 2.2 * uBarkColour, 0.6 * lenticelAt(mm)) * exp(-uStainAbsorb * stain);
      vec3 bone = uBoneColour * mix(1.0, clamp(grain, 0.6, 1.4), 0.25) * exp(-0.8 * stain * vec3(dot(uStainAbsorb, vec3(1.0 / 3.0))));
      diffuseColor.rgb = shade * (zone.w * mix(wood * exp(-uStainAbsorb * soak), bark, barkW)
        + zone.x * uMetalColour + zone.y * uPaintColour + zone.z * bone);`,
    )
    .replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
      roughnessFactor *= 1.0 - uStainGloss * clamp(vStain, 0.0, 1.0);
      // Raw wood: the map's variation about its own mean, so the grain sets where it is rougher.
      float rawWood = clamp(0.7 + 0.45 * (texelRoughness.g / uRoughMean - 1.0) + 0.15 * pore - 0.1 * fibre, 0.5, 0.92);
      roughnessFactor = mix(mix(roughnessFactor, rawWood, uMatte), 0.93, barkW);
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
