import type { Params } from '../engine/schema.ts'

// Each Kind of sword: its real-world bands (mm) that the 0-1 sliders map into,
// and its allowed options, signature first.

export type Family =
  'dagger' | 'shortSword' | 'knight' | 'longsword' | 'greatsword' | 'sabre' | 'katana' | 'rapier'

export type Band = [min: number, max: number]

export type Tip =
  'sharp' | 'rounded' | 'longPoint' | 'curvedPoint' | 'spear' | 'clipped' | 'kissaki'
export type GuardStyle =
  'straight' | 'curved' | 'winged' | 'sCurve' | 'dome' | 'knuckleBow' | 'disc' | 'swept' | 'cup'
export type Wrap = 'leather' | 'cord' | 'wire' | 'wood' | 'ribbed' | 'diamond'
export type PommelStyle =
  'wheel' | 'ball' | 'pear' | 'nut' | 'cap' | 'egg' | 'fishtail' | 'lobed' | 'block' | 'ring'
export type Steel = 'satin' | 'bright' | 'dark' | 'silver' | 'blue'
export type Fittings = 'iron' | 'darkIron' | 'brass' | 'bronze' | 'silver' | 'gold' | 'blue'

export interface FamilyDef {
  label: string
  edges: 'double' | 'single'
  hands: 1 | 2
  blade: Band
  baseWidth: Band
  /** Width near the tip over the base width, at taper 0 and taper 1. */
  tipRatio: [atTaper0: number, atTaper1: number]
  grip: Band
  /** Cross, bow and swept quillons, end to end. */
  guardSpan: Band
  discSpan?: Band
  /** A dome guard's diameter, or a Rapier's cup. */
  domeSpan?: Band
  /** Depth of the curve; [0, 0] on a straight Kind. */
  sagitta: Band
  /** Blade thickness at the base. */
  thickness: Band
  /** Where along the blade the curve is deepest, at curve 0 and curve 1; null when straight. */
  curvePeak: [number, number] | null
  /** Grip core radius before the shape; estimate, tune at G1. */
  gripRadius: number
  profile: string[]
  middle: string[]
  tip: Tip[]
  ricasso: string[]
  guard: GuardStyle[]
  wrap: Wrap[]
  pommel: PommelStyle[]
  waves: boolean
  langets: boolean
}

export const FAMILIES: Record<Family, FamilyDef> = {
  dagger: {
    label: 'Dagger',
    edges: 'double',
    hands: 1,
    blade: [220, 350],
    baseWidth: [26, 42],
    tipRatio: [0.55, 0.25],
    grip: [90, 110],
    guardSpan: [70, 120],
    discSpan: [50, 90],
    sagitta: [0, 0],
    thickness: [6, 8],
    curvePeak: null,
    gripRadius: 11,
    profile: ['straight', 'leaf'],
    middle: ['ridge', 'groove1', 'flat'],
    tip: ['longPoint', 'sharp'],
    ricasso: ['none', 'short'],
    guard: ['straight', 'curved', 'sCurve', 'disc'],
    wrap: ['cord', 'leather', 'wire', 'wood'],
    pommel: ['wheel', 'ball', 'nut', 'pear', 'ring'],
    waves: true,
    langets: false,
  },
  shortSword: {
    label: 'Short sword',
    edges: 'double',
    hands: 1,
    blade: [420, 620],
    baseWidth: [42, 65],
    tipRatio: [0.9, 0.55],
    grip: [90, 100],
    guardSpan: [90, 160],
    domeSpan: [70, 100],
    sagitta: [0, 0],
    thickness: [6, 7],
    curvePeak: null,
    gripRadius: 13,
    profile: ['straight', 'leaf', 'waisted'],
    middle: ['flat', 'ridge', 'groove1'],
    tip: ['sharp', 'longPoint', 'rounded'],
    ricasso: ['none'],
    guard: ['dome', 'straight', 'winged'],
    wrap: ['ribbed', 'leather', 'cord', 'wood'],
    pommel: ['ball', 'nut', 'block', 'lobed', 'ring'],
    waves: false,
    langets: false,
  },
  knight: {
    label: "Knight's sword",
    edges: 'double',
    hands: 1,
    blade: [700, 840],
    baseWidth: [45, 62],
    tipRatio: [0.85, 0.4],
    grip: [90, 115],
    guardSpan: [170, 250],
    sagitta: [0, 0],
    thickness: [6, 7],
    curvePeak: null,
    gripRadius: 12.5,
    profile: ['straight', 'leaf'],
    middle: ['groove1', 'flat', 'ridge', 'groove2'],
    tip: ['sharp', 'rounded', 'longPoint'],
    ricasso: ['none'],
    guard: ['straight', 'curved', 'sCurve', 'winged'],
    wrap: ['leather', 'cord', 'wire'],
    pommel: ['wheel', 'nut', 'pear', 'lobed', 'block', 'fishtail'],
    waves: false,
    langets: true,
  },
  longsword: {
    label: 'Longsword',
    edges: 'double',
    hands: 2,
    blade: [860, 1060],
    baseWidth: [40, 55],
    tipRatio: [0.7, 0.3],
    grip: [180, 260],
    guardSpan: [220, 320],
    sagitta: [0, 0],
    thickness: [7, 9],
    curvePeak: null,
    gripRadius: 13,
    profile: ['straight'],
    middle: ['ridge', 'groove1', 'groove2', 'groove3'],
    tip: ['longPoint', 'sharp'],
    ricasso: ['none', 'short'],
    guard: ['straight', 'curved', 'sCurve'],
    wrap: ['leather', 'cord', 'wire'],
    pommel: ['pear', 'wheel', 'nut', 'fishtail'],
    waves: true,
    langets: false,
  },
  greatsword: {
    label: 'Greatsword',
    edges: 'double',
    hands: 2,
    blade: [1000, 1300],
    baseWidth: [45, 65],
    tipRatio: [0.8, 0.4],
    grip: [280, 380],
    guardSpan: [350, 550],
    sagitta: [0, 0],
    thickness: [8, 10],
    curvePeak: null,
    gripRadius: 14,
    profile: ['straight'],
    middle: ['groove1', 'ridge', 'groove2'],
    tip: ['sharp', 'longPoint'],
    ricasso: ['short', 'none', 'long'],
    guard: ['curved', 'straight', 'sCurve'],
    wrap: ['leather', 'cord', 'wire'],
    pommel: ['wheel', 'pear', 'nut'],
    waves: true,
    langets: true,
  },
  sabre: {
    label: 'Sabre',
    edges: 'single',
    hands: 1,
    blade: [740, 880],
    baseWidth: [28, 40],
    tipRatio: [0.95, 0.65],
    grip: [100, 120],
    guardSpan: [120, 180],
    sagitta: [30, 100],
    thickness: [6, 8],
    curvePeak: [0.6, 0.68],
    gripRadius: 12,
    profile: ['straight', 'flared'],
    middle: ['groove1', 'flat'],
    tip: ['curvedPoint', 'spear', 'clipped'],
    ricasso: ['none'],
    guard: ['knuckleBow', 'straight'],
    wrap: ['leather', 'wire', 'wood'],
    pommel: ['cap', 'ball', 'nut'],
    waves: false,
    langets: true,
  },
  katana: {
    label: 'Katana',
    edges: 'single',
    hands: 2,
    blade: [600, 780],
    baseWidth: [28, 34],
    tipRatio: [0.78, 0.68],
    grip: [230, 300],
    guardSpan: [70, 90],
    discSpan: [70, 90],
    sagitta: [12, 24],
    thickness: [7, 8],
    curvePeak: [0.5, 0.5],
    gripRadius: 13.5,
    profile: ['straight'],
    middle: ['ridge', 'ridgeGroove'],
    tip: ['kissaki'],
    ricasso: ['none'],
    guard: ['disc'],
    wrap: ['diamond'],
    pommel: ['cap'],
    waves: false,
    langets: false,
  },
  rapier: {
    label: 'Rapier',
    edges: 'double',
    hands: 1,
    blade: [950, 1150],
    baseWidth: [20, 26],
    tipRatio: [0.5, 0.3],
    grip: [90, 120],
    guardSpan: [180, 280],
    domeSpan: [90, 110],
    sagitta: [0, 0],
    thickness: [7, 9],
    curvePeak: null,
    gripRadius: 11.5,
    profile: ['straight'],
    middle: ['ridge', 'groove1'],
    tip: ['longPoint'],
    ricasso: ['short', 'long'],
    guard: ['swept', 'cup', 'knuckleBow'],
    wrap: ['wire', 'leather', 'cord'],
    pommel: ['egg', 'ball', 'pear'],
    waves: false,
    langets: false,
  },
}

export const familyOf = (p: Params): FamilyDef => FAMILIES[p.family as Family] ?? FAMILIES.knight

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
export const inBand = ([min, max]: Band, t: number) => lerp(min, max, clamp(t, 0, 1))

/** The temper line is the Katana's signature pattern; every other Kind starts plain. */
const SIGNATURE_PATTERN: Partial<Record<Family, string>> = { katana: 'temper' }

/** The first allowed option of each per-Kind choice: what picking the Kind shows. */
export function signatureFor(family: Family): Partial<Params> {
  const f = FAMILIES[family]
  return {
    profile: f.profile[0]!,
    middle: f.middle[0]!,
    tip: f.tip[0]!,
    ricasso: f.ricasso[0]!,
    guard: f.guard[0]!,
    wrap: f.wrap[0]!,
    pommel: f.pommel[0]!,
    pattern: SIGNATURE_PATTERN[family] ?? 'plain',
  }
}

// Axial lengths of the hilt parts. Estimates, tune at G1.
/** Pommel length along the sword over its diameter. */
export const POMMEL_LENGTH: Record<string, number> = {
  wheel: 0.92,
  ball: 0.95,
  pear: 1.3,
  nut: 0.75,
  cap: 0.6,
  egg: 1.25,
  fishtail: 0.7,
  lobed: 0.6,
  block: 0.7,
  ring: 1,
}
/** Guard depth along the sword, mm: the cross's centre block, the disc, the dome or cup. */
export const GUARD_DEPTH: Record<string, number> = {
  straight: 16,
  curved: 16,
  sCurve: 16,
  winged: 20,
  dome: 28,
  knuckleBow: 14,
  disc: 7,
  swept: 22,
  cup: 40,
}
const COLLAR_MM = 25

/** Blade length, shoulder to tip, mm. */
export const bladeLengthMm = (p: Params): number =>
  inBand(familyOf(p).blade, p.bladeLength as number)

/** Base width: the slider in its band, gaining up to 10% with length, kept in the band. */
export function baseWidthMm(p: Params): number {
  const band = familyOf(p).baseWidth
  const grown = inBand(band, p.bladeWidth as number) * (0.95 + 0.1 * (p.bladeLength as number))
  return clamp(grown, band[0], band[1])
}

/** Grip length; a two-hander's grip also stays 0.2-0.3 of its blade. */
export function gripLengthMm(p: Params): number {
  const f = familyOf(p)
  const grip = inBand(f.grip, p.gripLength as number)
  if (p.family !== 'longsword' && p.family !== 'greatsword') return grip
  const blade = bladeLengthMm(p)
  const scaled = (grip * blade) / lerp(f.blade[0], f.blade[1], 0.5)
  return clamp(scaled, Math.max(f.grip[0], 0.2 * blade), Math.min(f.grip[1], 0.3 * blade))
}

/** The grip's radius along u (pommel side to guard side) over `gripRadius`, per grip shape. */
export const GRIP_SHAPES: Record<string, [u: number, value: number][]> = {
  straight: [
    [0, 1],
    [1, 1],
  ],
  swelling: [
    [0, 0.92],
    [0.5, 1.1],
    [1, 0.92],
  ],
  waisted: [
    [0, 1.06],
    [0.5, 0.9],
    [1, 1.06],
  ],
}

/** The grip's radius where it meets the pommel, mm. */
export const gripEndRadiusMm = (p: Params): number =>
  familyOf(p).gripRadius * (GRIP_SHAPES[p.gripShape as string] ?? GRIP_SHAPES.straight!)[0]![1]

/**
 * Pommel diameter: 0.8-1.2x the base width on one hand, 1.0-1.4x on two, never lost in the
 * grip. A cap sits nearly flush with the grip's end instead.
 */
export function pommelDiameterMm(p: Params): number {
  const f = familyOf(p)
  const size = p.pommelSize as number
  const gripEnd = gripEndRadiusMm(p) * 2
  if (p.pommel === 'cap') return gripEnd * lerp(1.05, 1.15, size)
  const ratio = f.hands === 2 ? lerp(1.0, 1.4, size) : lerp(0.8, 1.2, size)
  return Math.max(baseWidthMm(p) * ratio, gripEnd * lerp(1.25, 1.5, size))
}

export const pommelLengthMm = (p: Params): number =>
  pommelDiameterMm(p) * (POMMEL_LENGTH[p.pommel as string] ?? 0.6)

export const guardDepthMm = (p: Params): number => GUARD_DEPTH[p.guard as string] ?? 16

export const collarMm = (p: Params): number => (p.family === 'katana' ? COLLAR_MM : 0)

/**
 * Overall length, mm, without building a spec: pommel + grip + guard + blade along one
 * straight axis, before any curve. The bend keeps the blade's length along its curve, so a
 * curved sword's drawn pommel-to-tip distance is shorter (see `SwordSpec.lengthMm`).
 */
export const overallLengthMm = (p: Params): number =>
  pommelLengthMm(p) + gripLengthMm(p) + guardDepthMm(p) + bladeLengthMm(p)
