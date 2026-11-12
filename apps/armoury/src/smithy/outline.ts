import type { SwordSpec } from '../sword/compile.ts'

// How the smithy frames a sword's outline (`swordOutline`, closed polylines of [z, y] in mm)
// as an SVG: the whole sword, or cropped to its guard or its pommel.

type Polyline = [number, number][]

export type Crop = 'sword' | 'guard' | 'pommel'

const PAD = 6

/** The SVG viewBox, in the outline's mm, that frames the whole sword, its guard or its pommel. */
export function viewBoxFor(spec: SwordSpec, outline: Polyline[], crop: Crop): string {
  const window: [number, number] =
    crop === 'guard'
      ? [
          Math.min(spec.guard.from, spec.guard.from + spec.guard.sweep) - 30,
          Math.max(spec.guard.to, spec.guard.to + spec.guard.sweep) + 40,
        ]
      : crop === 'pommel'
        ? [-PAD, spec.pommel.to + (spec.grip.to - spec.grip.from) * 0.4]
        : [-Infinity, Infinity]
  const inside = outline.flat().filter(([z]) => z >= window[0] && z <= window[1])
  const zs = inside.map(([z]) => z)
  const ys = inside.map(([, y]) => y)
  const z0 = Math.max(window[0], Math.min(...zs) - PAD)
  const z1 = Math.min(window[1], Math.max(...zs) + PAD)
  const y0 = Math.min(...ys) - PAD
  const y1 = Math.max(...ys) + PAD
  return [z0, y0, z1 - z0, y1 - y0].map((n) => Math.round(n * 10) / 10).join(' ')
}

export function pathOf(outline: Polyline[]): string {
  return outline
    .map((line) => `M${line.map(([z, y]) => `${z.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`)
    .join('')
}
