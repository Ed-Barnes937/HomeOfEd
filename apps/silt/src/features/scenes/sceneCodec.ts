import {
  BYTES_PER_CELL,
  EMPTY,
  RA_OFFSET,
  RB_OFFSET,
  SPECIES_OFFSET,
  type ElementRegistry,
} from '../../sim/index.ts'
import type { Spawner } from '../spawners/spawners.ts'

/**
 * The scene format (spec §8). Pure and headless: no DOM, no storage, no React —
 * it turns grid bytes into an envelope and back, and every rule that can make a
 * load go wrong (renumbered ids, a retired element, a differently sized world)
 * is decided here where it can be tested without a browser.
 */

export const SCENE_VERSION = 1

/** What the codec needs of a world: dimensions and the interleaved cell bytes. */
export interface CellSource {
  readonly width: number
  readonly height: number
  readonly cells: Uint8Array
}

export interface SceneEnvelope {
  version: number
  width: number
  height: number
  /** A seam for future RLE / compression values — v1 only ever writes "raw". */
  encoding: 'raw'
  /** What each species byte meant at save time, so load can remap by name. */
  elements: Record<string, string>
  species: string
  ra: string
  rb: string
  spawners: readonly { x: number; y: number; element: string }[]
}

/** The world a scene decoded to, sized to the *current* grid and ready to apply. */
export interface DecodedScene {
  species: Uint8Array
  ra: Uint8Array
  rb: Uint8Array
  spawners: Spawner[]
  /** Non-fatal losses (a retired element, a dropped spawner). The load still succeeded. */
  warnings: string[]
}

/** A load that cannot proceed. The message is written to be shown to a person. */
export class SceneLoadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneLoadError'
  }
}

// `String.fromCharCode(...)` on a whole 60 000-byte plane blows the argument
// limit, so the string is built a chunk at a time.
const BASE64_CHUNK = 0x8000

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK))
  }
  return btoa(binary)
}

function fromBase64(text: string, field: string): Uint8Array {
  let binary: string
  try {
    binary = atob(text)
  } catch {
    throw new SceneLoadError(`scene is corrupt: ${field} is not valid base64`)
  }
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function plane(source: CellSource, offset: number): Uint8Array {
  const count = source.width * source.height
  const bytes = new Uint8Array(count)
  for (let cell = 0; cell < count; cell++) {
    bytes[cell] = source.cells[cell * BYTES_PER_CELL + offset]!
  }
  return bytes
}

/**
 * Snapshot a world. `clock` is runtime bookkeeping and is deliberately not
 * persisted; `ra`/`rb` are, so a reload is pixel-identical.
 */
export function encodeScene(
  source: CellSource,
  spawners: readonly Spawner[],
  registry: ElementRegistry,
): SceneEnvelope {
  const elements: Record<string, string> = {}
  for (const def of registry.all()) elements[String(def.id)] = def.name

  return {
    version: SCENE_VERSION,
    width: source.width,
    height: source.height,
    encoding: 'raw',
    elements,
    species: toBase64(plane(source, SPECIES_OFFSET)),
    ra: toBase64(plane(source, RA_OFFSET)),
    rb: toBase64(plane(source, RB_OFFSET)),
    spawners: spawners.flatMap((spawner) => {
      const name = registry.get(spawner.element)?.name
      return name ? [{ x: spawner.x, y: spawner.y, element: name }] : []
    }),
  }
}

function parse(json: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    throw new SceneLoadError('scene is corrupt: not valid JSON')
  }
  if (typeof value !== 'object' || value === null) {
    throw new SceneLoadError('scene is corrupt: not a scene object')
  }
  return value as Record<string, unknown>
}

function dimension(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) {
    throw new SceneLoadError(`scene is corrupt: ${field} is not a positive whole number`)
  }
  return value as number
}

/**
 * Splits the envelope's name table into bytes that still resolve and bytes
 * whose element the registry has lost. The lost ones only become a warning if
 * the scene actually contains such a cell — a roster that merely shrank should
 * not shout about elements the scene never used.
 */
function speciesMap(
  table: Record<string, string>,
  idsByName: ReadonlyMap<string, number>,
): { known: Map<number, number>; missing: Map<number, string> } {
  const known = new Map<number, number>()
  const missing = new Map<number, string>()
  for (const [byte, name] of Object.entries(table)) {
    const id = idsByName.get(name)
    if (id === undefined) missing.set(Number(byte), name)
    else known.set(Number(byte), id)
  }
  return { known, missing }
}

/**
 * Read a scene back into planes sized to the *current* grid.
 *
 * Species bytes are remapped through the envelope's name table, so a registry
 * that has renumbered its ids still loads. A smaller scene is pasted anchored
 * bottom-centre (its spawners offset identically); a larger one is refused —
 * cropping a world silently would be the destructive option.
 */
export function decodeScene(
  json: string,
  target: { width: number; height: number },
  registry: ElementRegistry,
): DecodedScene {
  const envelope = parse(json)

  if (envelope.version !== SCENE_VERSION) {
    throw new SceneLoadError(
      `scene version ${String(envelope.version)} is not supported (this build reads version ${SCENE_VERSION})`,
    )
  }
  if (envelope.encoding !== 'raw') {
    throw new SceneLoadError(`scene encoding "${String(envelope.encoding)}" is not supported`)
  }

  const width = dimension(envelope.width, 'width')
  const height = dimension(envelope.height, 'height')
  if (width > target.width || height > target.height) {
    throw new SceneLoadError(
      `scene is ${width}×${height}, larger than this world (${target.width}×${target.height})`,
    )
  }

  const count = width * height
  const planes = (['species', 'ra', 'rb'] as const).map((field) => {
    const raw = envelope[field]
    if (typeof raw !== 'string') {
      throw new SceneLoadError(`scene is corrupt: ${field} is missing`)
    }
    const bytes = fromBase64(raw, field)
    if (bytes.length !== count) {
      throw new SceneLoadError(
        `scene is corrupt: ${field} holds ${bytes.length} bytes, expected ${count}`,
      )
    }
    return bytes
  })
  const [savedSpecies, savedRa, savedRb] = planes as [Uint8Array, Uint8Array, Uint8Array]

  const warnings: string[] = []
  const idsByName = new Map(registry.all().map((def) => [def.name, def.id]))
  const table = (envelope.elements ?? {}) as Record<string, string>
  const { known, missing } = speciesMap(table, idsByName)
  const warned = new Set<number>()

  // Bottom-centre: the world has a floor, so extra room belongs above and
  // evenly to the sides — a scene keeps sitting on the ground it was built on.
  const offsetX = Math.floor((target.width - width) / 2)
  const offsetY = target.height - height

  const size = target.width * target.height
  const species = new Uint8Array(size)
  const ra = new Uint8Array(size)
  const rb = new Uint8Array(size)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const from = y * width + x
      const saved = savedSpecies[from]!
      if (saved === EMPTY) continue
      const id = known.get(saved)
      if (id === undefined) {
        // Unknown element → empty cell; the load still succeeds (spec §8).
        if (!warned.has(saved)) {
          warned.add(saved)
          const name = missing.get(saved) ?? `species ${saved}`
          warnings.push(`element "${name}" no longer exists — those cells were left empty`)
        }
        continue
      }
      const to = (y + offsetY) * target.width + (x + offsetX)
      species[to] = id
      ra[to] = savedRa[from]!
      rb[to] = savedRb[from]!
    }
  }

  const savedSpawners = Array.isArray(envelope.spawners) ? (envelope.spawners as unknown[]) : []
  const spawners: Spawner[] = []
  for (const entry of savedSpawners) {
    if (typeof entry !== 'object' || entry === null) continue
    // Extra fields a future version might add are simply ignored.
    const { x, y, element } = entry as { x?: unknown; y?: unknown; element?: unknown }
    if (!Number.isInteger(x) || !Number.isInteger(y) || typeof element !== 'string') continue
    const id = idsByName.get(element)
    if (id === undefined) {
      warnings.push(`spawner dropped: element "${element}" no longer exists`)
      continue
    }
    const sx = (x as number) + offsetX
    const sy = (y as number) + offsetY
    if (sx < 0 || sy < 0 || sx >= target.width || sy >= target.height) continue
    spawners.push({ x: sx, y: sy, element: id })
  }

  return { species, ra, rb, spawners, warnings }
}
