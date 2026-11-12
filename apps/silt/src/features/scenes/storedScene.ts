/**
 * How a scene sits in IndexedDB (ADR 0102): the envelope `sceneCodec` writes,
 * with its three base64 planes held as bytes, and the thumbnail as PNG bytes.
 * The format's meaning is unchanged; `unpackScene` gives `decodeScene` back the
 * envelope it expects.
 */
import { fromBase64, toBase64 } from './sceneCodec.ts'

const PLANE_NAMES = ['species', 'ra', 'rb'] as const
const PNG_DATA_URL = 'data:image/png;base64,'

export interface ScenePlanes {
  species: Uint8Array
  ra: Uint8Array
  rb: Uint8Array
}

/** A scene's stored body. Text that is not a well-formed envelope is kept as it was. */
export type SceneBody =
  | { kind: 'planes'; envelope: Record<string, unknown>; planes: ScenePlanes }
  | { kind: 'json'; json: string }

export function packScene(json: string): SceneBody {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { kind: 'json', json }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'json', json }
  }
  const { species, ra, rb, ...envelope } = parsed as Record<string, unknown>
  try {
    const planes = { species: plane(species), ra: plane(ra), rb: plane(rb) }
    return { kind: 'planes', envelope, planes }
  } catch {
    return { kind: 'json', json }
  }
}

export function unpackScene(body: SceneBody): string {
  if (body.kind === 'json') return body.json
  const planes = Object.fromEntries(PLANE_NAMES.map((name) => [name, toBase64(body.planes[name])]))
  return JSON.stringify({ ...body.envelope, ...planes })
}

/** A thumbnail's PNG bytes, or `null` for anything else: it is decoration. */
export function packThumbnail(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(PNG_DATA_URL)) return null
  try {
    return fromBase64(dataUrl.slice(PNG_DATA_URL.length), 'thumbnail')
  } catch {
    return null
  }
}

export function thumbnailUrl(png: Uint8Array): string {
  return `${PNG_DATA_URL}${toBase64(png)}`
}

function plane(value: unknown): Uint8Array {
  if (typeof value !== 'string') throw new TypeError('plane is not base64 text')
  return fromBase64(value, 'plane')
}
