/**
 * The one-time move of a device's scenes out of localStorage, where they used
 * to live (ADR 0029), into IndexedDB's device namespace (ADR 0102, ADR 0094's
 * one sanctioned move). The keys are removed only after the IndexedDB write
 * has committed, so it is safe to interrupt anywhere and run again: what was
 * already moved is skipped by id, and nothing is removed before it is safe.
 */
import { DEVICE_NAMESPACE, type SceneRecords, type StoredScene } from './sceneRecords.ts'
import { packScene, packThumbnail } from './storedScene.ts'

export const LEGACY_INDEX_KEY = 'silt:scenes'
const BLOB_PREFIX = 'silt:scene:'
const THUMB_PREFIX = 'silt:thumb:'

/** The slice of `localStorage` the move reads and frees. */
export interface LegacyStorage {
  readonly length: number
  key(index: number): string | null
  getItem(key: string): string | null
  removeItem(key: string): void
}

export async function moveLegacyScenes(
  records: SceneRecords,
  device: LegacyStorage,
  now: () => number,
): Promise<void> {
  const { scenes, keys } = readLegacyScenes(device, now)
  if (keys.length === 0) return
  await records.addMissing(DEVICE_NAMESPACE, scenes)
  for (const key of keys) device.removeItem(key)
}

interface LegacyRow {
  id: string
  name: string
  updatedAt: number
}

/** The scenes as the old store's boot repair saw them, and the keys to free (the index last). */
function readLegacyScenes(
  device: LegacyStorage,
  now: () => number,
): { scenes: StoredScene[]; keys: string[] } {
  const blobs = new Map<string, string>()
  const thumbs = new Map<string, string>()
  const keys: string[] = []
  for (let i = 0; i < device.length; i++) {
    const key = device.key(i)
    // A key with `@` belongs to a profile, never to the device.
    if (key === null || key.includes('@')) continue
    if (key.startsWith(BLOB_PREFIX)) blobs.set(key.slice(BLOB_PREFIX.length), key)
    else if (key.startsWith(THUMB_PREFIX)) thumbs.set(key.slice(THUMB_PREFIX.length), key)
  }
  keys.push(...blobs.values(), ...thumbs.values())
  const index = device.getItem(LEGACY_INDEX_KEY)
  if (index !== null) keys.push(LEGACY_INDEX_KEY)

  // Listed rows keep their order; a blob the index never learned of is recovered, as before.
  const listed = legacyRows(index).filter((row) => blobs.has(row.id))
  const recovered = [...blobs.keys()]
    .filter((id) => !listed.some((row) => row.id === id))
    .map((id) => ({ id, name: 'recovered scene', updatedAt: now() }))

  const scenes = [...listed, ...recovered].flatMap((row, order) => {
    const json = device.getItem(blobs.get(row.id)!)
    if (json === null) return []
    const thumbKey = thumbs.get(row.id)
    const thumb = thumbKey ? device.getItem(thumbKey) : null
    return [
      { ...row, order, body: packScene(json), thumbnail: thumb ? packThumbnail(thumb) : null },
    ]
  })
  return { scenes, keys }
}

function legacyRows(raw: string | null): LegacyRow[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (row): row is LegacyRow =>
      typeof row === 'object' &&
      row !== null &&
      typeof (row as LegacyRow).id === 'string' &&
      typeof (row as LegacyRow).name === 'string' &&
      typeof (row as LegacyRow).updatedAt === 'number',
  )
}
