import { seededRandom } from '../engine/schema.ts'
import { STAGE_FILL } from '../stage/stage.ts'
import type { SwordSpec } from '../sword/compile.ts'
import { drawnFraction } from '../sword/framing.ts'
import { swordOutline } from '../sword/outline.ts'

// The anvil on its stump, seen from straight above in the sword stage's own frame: units are
// the anvil button's box (ANVIL_W by ANVIL_H), the forge's warm key from the left and low,
// the window's cool light from the right and high.

export const ANVIL_W = 1000
export const ANVIL_H = 170
/** The stage slot is this much wider than the button it sits in (15% each side). */
const SLOT_SPREAD = 1.3
/** The drawing reaches past the button: x from ART_X, y from ART_Y, ART_WIDTH by ART_HEIGHT. */
export const ART_X = -70
export const ART_Y = -170
export const ART_WIDTH = 1140
export const ART_HEIGHT = 510

const FACE = { left: 212, right: 790, top: 38, bottom: 132 }
const STUMP = { x: 500, y: 96, r: 172 }
const HORN =
  'M24 79 C24 75 28 73 34 72.5 C70 66 110 54 142 46 L142 124 C110 116 70 104 34 97.5 ' +
  'C28 97 24 94 24 90 Z'

/** The anvil's working top (horn, step and face): what the sword lies on. */
export const ANVIL_TOP =
  'M24 79 C24 75 28 73 34 72.5 C70 66 110 54 142 46 L142 44 L212 44 L212 38 L784 38 ' +
  'Q790 38 790 44 L790 126 Q790 132 784 132 L212 132 L212 126 L142 126 L142 124 ' +
  'C110 116 70 104 34 97.5 C28 97 24 94 24 90 Z'

const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * The sword's top-down outline where the stage draws it, split into the blade and the taller
 * hilt (which casts further), and where its grip is (0-1 across).
 */
export function swordOnAnvil(spec: SwordSpec): {
  d: string
  blade: string
  hilt: string
  gripX: number
} {
  const length = drawnFraction(spec.lengthMm) * STAGE_FILL * SLOT_SPREAD * ANVIL_W
  const k = length / spec.lengthMm
  const x0 = ANVIL_W / 2 - length / 2
  const polys = swordOutline(spec)
  const span = (poly: [number, number][]) =>
    Math.max(...poly.map((p) => p[0])) - Math.min(...poly.map((p) => p[0]))
  const longest = polys.reduce((best, poly, i) => (span(poly) > span(polys[best]!) ? i : best), 0)
  const path = (poly: [number, number][]) =>
    'M' + poly.map(([z, y]) => `${r1(x0 + z * k)} ${r1(ANVIL_H / 2 + y * k)}`).join('L') + 'Z'
  const blade = path(polys[longest]!)
  const hilt = polys
    .filter((_, i) => i !== longest)
    .map(path)
    .join('')
  return { d: blade + hilt, blade, hilt, gripX: (x0 + spec.gripAt * length) / ANVIL_W }
}

function wobblyRing(rand: () => number, cx: number, cy: number, r: number): string {
  const n = 48
  const phase = rand() * 6.28
  const amp = 0.6 + rand() * 1.8
  let d = ''
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = r + Math.sin(a * 3 + phase) * amp + Math.sin(a * 7 + phase * 2) * amp * 0.4
    d += `${i ? 'L' : 'M'}${r1(cx + Math.cos(a) * rr)} ${r1(cy + Math.sin(a) * rr)}`
  }
  return d + 'Z'
}

function stump(rand: () => number): string {
  const { x, y, r } = STUMP
  let rings = ''
  for (let rr = 10; rr < r - 12; rr += 5 + rand() * 5) {
    rings += `<path d="${wobblyRing(rand, x - 6, y + 4, rr)}" stroke="rgba(38,22,12,${r1(0.22 + rand() * 0.25)})" stroke-width="${r1(1 + rand() * 1.6)}"/>`
  }
  let checks = ''
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2
    const from = 50 + rand() * 60
    const to = r - 2
    const w = 1 + rand() * 2.2
    const [c, s] = [Math.cos(a), Math.sin(a)]
    checks += `<path d="M${r1(x + c * from)} ${r1(y + s * from)} L${r1(x + c * to - s * w)} ${r1(y + s * to + c * w)} L${r1(x + c * to + s * w)} ${r1(y + s * to - c * w)}Z" fill="#160d07" opacity="0.8"/>`
  }
  let marks = ''
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * (r - 16)
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    const ash = rand() < 0.35
    marks += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${r1(0.8 + rand() * 1.8)}" fill="${ash ? '#8a8178' : '#140c07'}" opacity="${r1(0.25 + rand() * 0.4)}"/>`
  }
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2
    const d = 60 + rand() * 120
    const px = x + Math.cos(a) * d
    const py = y + Math.sin(a) * d
    const t = rand() * Math.PI
    marks += `<path d="M${r1(px)} ${r1(py)} l${r1(Math.cos(t) * 22)} ${r1(Math.sin(t) * 22)}" stroke="#1e1209" stroke-width="2" opacity="0.45" stroke-linecap="round"/>`
  }
  return (
    `<circle cx="${x + 42}" cy="${y - 4}" r="${r + 8}" fill="#000" opacity="0.6" filter="url(#soft)"/>` +
    `<circle cx="${x - 16}" cy="${y + 24}" r="${r + 4}" fill="#000" opacity="0.4" filter="url(#soft)"/>` +
    `<circle cx="${x}" cy="${y + 14}" r="${r}" fill="#1a100a"/>` +
    `<path d="M${x - r} ${y + 8} A${r} ${r} 0 0 0 ${x + r} ${y + 8}" stroke="#4a4642" stroke-width="5" fill="none" opacity="0.8"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#grain)"/>` +
    `<g fill="none">${rings}</g>${checks}${marks}` +
    `<circle cx="${x}" cy="${y}" r="${r - 4}" fill="none" stroke="#21150c" stroke-width="9"/>` +
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#stumpLight)"/>` +
    `<path d="M${x - r * 0.72} ${y - r * 0.69} A${r - 1} ${r - 1} 0 0 0 ${x - r * 0.72} ${y + r * 0.69}" stroke="#d48a52" stroke-width="2.5" fill="none" opacity="0.55"/>` +
    `<path d="M${x + r * 0.5} ${y - r * 0.86} A${r - 1} ${r - 1} 0 0 1 ${x + r * 0.97} ${y + r * 0.2}" stroke="#a9c3e6" stroke-width="2" fill="none" opacity="0.35"/>`
  )
}

// The base seen past the face: four splayed feet joined by the waist, which the face hides.
const BASE =
  'M262 14 Q258 4 272 2 L338 6 Q500 34 664 6 L734 2 Q748 4 744 14 L744 156 Q748 166 734 168 ' +
  'L664 164 Q500 136 338 164 L272 168 Q258 166 262 156 Z'

function feet(): string {
  return (
    `<path d="${BASE}" fill="#000" opacity="0.9" filter="url(#soft)" transform="translate(22 -2)"/>` +
    `<g filter="url(#blur1)"><path d="${BASE}" fill="url(#foot)"/>` +
    `<path d="${BASE}" fill="url(#footShade)"/></g>` +
    `<path d="M264 12 Q262 6 272 4 L336 8" stroke="#d48e5e" stroke-width="1.6" fill="none" opacity="0.55"/>` +
    `<path d="M262 158 Q262 164 272 166 L336 162" stroke="#c4825a" stroke-width="1.4" fill="none" opacity="0.35"/>` +
    `<path d="M668 8 L734 4 Q744 6 742 14" stroke="#a9bfda" stroke-width="1.3" fill="none" opacity="0.35"/>`
  )
}

function faceWear(rand: () => number): string {
  let out = ''
  for (let i = 0; i < 170; i++) {
    const x = FACE.left + 8 + rand() * (FACE.right - FACE.left - 16)
    const y = FACE.top + 6 + rand() * (FACE.bottom - FACE.top - 12)
    const len = 4 + rand() * 22
    const t = (rand() - 0.5) * 0.5 + (rand() < 0.15 ? 0.8 : 0)
    const light = rand() < 0.6
    out += `<path d="M${r1(x)} ${r1(y)} l${r1(Math.cos(t) * len)} ${r1(Math.sin(t) * len)}" stroke="${light ? '#fff' : '#000'}" stroke-opacity="${r1(light ? 0.03 + rand() * 0.05 : 0.04 + rand() * 0.06)}" stroke-width="${r1(0.4 + rand() * 0.5)}"/>`
  }
  for (let i = 0; i < 10; i++) {
    const x = FACE.left + 20 + rand() * (FACE.right - FACE.left - 40)
    const y = FACE.top + 10 + rand() * (FACE.bottom - FACE.top - 20)
    const rr = 1.5 + rand() * 3
    out += `<ellipse cx="${r1(x)}" cy="${r1(y)}" rx="${r1(rr * 1.4)}" ry="${r1(rr)}" fill="#1b1c1f" opacity="0.35"/><path d="M${r1(x - rr)} ${r1(y + rr * 0.6)} q${r1(rr)} ${r1(rr * 0.8)} ${r1(rr * 2)} 0" stroke="#fff" stroke-opacity="0.2" stroke-width="0.8"/>`
  }
  for (let i = 0; i < 9; i++) {
    const top = rand() < 0.5
    const x = FACE.left + 30 + rand() * (FACE.right - FACE.left - 60)
    const y = top ? FACE.top : FACE.bottom
    const w = 4 + rand() * 10
    out += `<path d="M${r1(x)} ${y} q${r1(w / 2)} ${top ? 3 : -3} ${r1(w)} 0" fill="#26272a"/>`
  }
  return out
}

/** The anvil on its stump, top-down, as an SVG the size of ART_* in button units. */
export function anvilSvg(): string {
  const rand = seededRandom(4417)
  const { left, right, top, bottom } = FACE
  const face = `x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" rx="6"`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ART_WIDTH}" height="${ART_HEIGHT}" viewBox="${ART_X} ${ART_Y} ${ART_WIDTH} ${ART_HEIGHT}">` +
    `<defs>` +
    `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="8"/></filter>` +
    `<filter id="blur2"><feGaussianBlur stdDeviation="2"/></filter>` +
    `<filter id="blur1" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="1.2"/></filter>` +
    `<filter id="iron" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.9 0 0 0 -0.42"/></filter>` +
    `<filter id="woodGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="5"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.8 0 0 0 -0.3"/></filter>` +
    `<clipPath id="faceClip"><rect ${face}/></clipPath>` +
    `<clipPath id="stumpClip"><circle cx="${STUMP.x}" cy="${STUMP.y}" r="${STUMP.r}"/></clipPath>` +
    `<radialGradient id="grain" cx="0.45" cy="0.45" r="0.6"><stop offset="0" stop-color="#7c5a3c"/><stop offset="0.55" stop-color="#604430"/><stop offset="0.9" stop-color="#47321f"/><stop offset="1" stop-color="#2c1d12"/></radialGradient>` +
    `<linearGradient id="stumpLight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a52" stop-opacity="0.22"/><stop offset="0.45" stop-color="#000" stop-opacity="0.1"/><stop offset="1" stop-color="#9fc2e8" stop-opacity="0.12"/></linearGradient>` +
    `<linearGradient id="foot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3a2a20"/><stop offset="0.2" stop-color="#1c1a19"/><stop offset="0.75" stop-color="#161719"/><stop offset="1" stop-color="#222830"/></linearGradient>` +
    `<linearGradient id="footShade" x1="0" y1="0" x2="0" y2="170" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.06"/><stop offset="0.2" stop-color="#000" stop-opacity="0.55"/><stop offset="0.3" stop-color="#000" stop-opacity="0.8"/><stop offset="0.7" stop-color="#000" stop-opacity="0.8"/><stop offset="0.8" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0.1"/></linearGradient>` +
    `<linearGradient id="faceTone" x1="${left}" y1="0" x2="${right}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#655a52"/><stop offset="0.3" stop-color="#535352"/><stop offset="0.7" stop-color="#4f5459"/><stop offset="1" stop-color="#606b77"/></linearGradient>` +
    `<linearGradient id="faceDepth" x1="0" y1="${top}" x2="0" y2="${bottom}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000" stop-opacity="0.45"/><stop offset="0.1" stop-color="#000" stop-opacity="0.1"/><stop offset="0.35" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.1"/><stop offset="0.65" stop-color="#fff" stop-opacity="0.04"/><stop offset="0.9" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0.5"/></linearGradient>` +
    `<radialGradient id="polish" cx="${left + (right - left) * 0.62}" cy="${top + 28}" r="320" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${top + 28}) scale(1 0.07) translate(0 ${-(top + 28)})"><stop offset="0" stop-color="#e6eef8" stop-opacity="0.42"/><stop offset="0.45" stop-color="#dfe8f2" stop-opacity="0.14"/><stop offset="1" stop-color="#dfe6ee" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="worn" cx="${(left + right) / 2}" cy="${(top + bottom) / 2}" r="220" gradientUnits="userSpaceOnUse" gradientTransform="translate(0 ${(top + bottom) / 2}) scale(1 0.3) translate(0 ${-(top + bottom) / 2})"><stop offset="0" stop-color="#fff" stop-opacity="0.09"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<radialGradient id="warmEnd" cx="${left + 30}" cy="${bottom - 20}" r="250" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff9f5a" stop-opacity="0.34"/><stop offset="1" stop-color="#ff9f5a" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="edgeLight" x1="${left}" y1="0" x2="${right}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbf86"/><stop offset="0.45" stop-color="#bdb7b0"/><stop offset="1" stop-color="#cfe0f6"/></linearGradient>` +
    `<linearGradient id="step" x1="142" y1="0" x2="212" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#5a4639"/><stop offset="0.5" stop-color="#3b3a3a"/><stop offset="1" stop-color="#2e2f31"/></linearGradient>` +
    `<linearGradient id="horn" x1="0" y1="46" x2="0" y2="124" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#b77a4c"/><stop offset="0.12" stop-color="#3e3532"/><stop offset="0.34" stop-color="#7c848e"/><stop offset="0.5" stop-color="#4c5056"/><stop offset="0.8" stop-color="#202124"/><stop offset="1" stop-color="#0f0f11"/></linearGradient>` +
    `<linearGradient id="hornWarm" x1="24" y1="0" x2="142" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff9a52" stop-opacity="0.3"/><stop offset="1" stop-color="#ff9a52" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    stump(rand) +
    `<g clip-path="url(#stumpClip)"><rect x="${STUMP.x - STUMP.r}" y="${STUMP.y - STUMP.r}" width="${STUMP.r * 2}" height="${STUMP.r * 2}" filter="url(#woodGrain)" opacity="0.5"/></g>` +
    feet() +
    `<path d="${ANVIL_TOP}" fill="#000" opacity="0.85" filter="url(#soft)" transform="translate(26 -3)"/>` +
    `<path d="${ANVIL_TOP}" fill="#000" opacity="0.35" filter="url(#soft)" transform="translate(-10 16)"/>` +
    `<path d="${HORN}" fill="url(#horn)"/>` +
    `<path d="${HORN}" fill="url(#hornWarm)"/>` +
    `<path d="M26 77 C30 73 34 72.5 34 72.5 C70 66 110 54 141 47" stroke="#ffc18c" stroke-width="1.3" fill="none" opacity="0.55"/>` +
    `<path d="M40 80 C80 74 112 66 140 62" stroke="#c9d6e6" stroke-width="2.5" fill="none" opacity="0.18" filter="url(#blur2)"/>` +
    `<rect x="142" y="44" width="70" height="82" fill="url(#step)"/>` +
    `<path d="M142 44.8 H212" stroke="#d99a6a" stroke-width="1.2" opacity="0.5"/>` +
    `<path d="M142 125.2 H212" stroke="#000" stroke-width="2" opacity="0.6"/>` +
    `<rect x="${left + 2}" y="${bottom - 2}" width="${right - left - 6}" height="7" rx="2" fill="#121315"/>` +
    `<rect ${face} fill="#1a1b1d"/>` +
    `<rect x="${left + 2}" y="${top + 2}" width="${right - left - 4}" height="${bottom - top - 4}" rx="5" fill="url(#faceTone)"/>` +
    `<g clip-path="url(#faceClip)">` +
    `<rect ${face} filter="url(#iron)" opacity="0.08"/>` +
    `<rect ${face} fill="url(#worn)"/>` +
    `<rect ${face} fill="url(#warmEnd)"/>` +
    `<rect ${face} fill="url(#polish)"/>` +
    `<rect ${face} fill="url(#faceDepth)"/>` +
    faceWear(rand) +
    `</g>` +
    `<path d="M${left + 5} ${top + 2.2} H${right - 5}" stroke="url(#edgeLight)" stroke-width="1.6" opacity="0.7"/>` +
    `<path d="M${left + 2} ${top + 5} V${bottom - 5}" stroke="#e8a46c" stroke-width="2.2" opacity="0.7"/>` +
    `<path d="M${right - 2} ${top + 6} V${bottom - 6}" stroke="#b9cbe2" stroke-width="1.4" opacity="0.45"/>` +
    `<path d="M${left + 5} ${bottom - 2} H${right - 5}" stroke="#000" stroke-width="1.6" opacity="0.5"/>` +
    `<path d="M${left + 6} ${bottom - 3.6} H${(left + right) / 2}" stroke="#e39a62" stroke-width="1" opacity="0.35"/>` +
    `<rect x="728" y="74" width="24" height="24" rx="1.5" fill="#060606"/>` +
    `<path d="M728 98 H752 V74" stroke="#aebccd" stroke-width="1.1" fill="none" opacity="0.4"/>` +
    `<circle cx="694" cy="86" r="7" fill="#060606"/>` +
    `<path d="M687.5 88.5 A7 7 0 0 0 700.5 88.5" stroke="#aebccd" stroke-width="1" fill="none" opacity="0.4"/>` +
    `</svg>`
  )
}

export const ANVIL_IMAGE = `url("data:image/svg+xml,${encodeURIComponent(anvilSvg())}")`
