// Node side: a device as the localStorage build left it (ADR 0029), for the
// one-time move to IndexedDB (ADR 0102).
import type { Page } from '@playwright/test'

import { encodeScene } from '../features/scenes/sceneCodec.ts'
import {
  BYTES_PER_CELL,
  createRegistry,
  GRID_HEIGHT,
  GRID_WIDTH,
  SAND,
  SPECIES_OFFSET,
  v1Elements,
  v1Reactions,
} from '../sim/index.ts'

const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

export interface LegacyScene {
  id: string
  name: string
  /** The one sand cell the scene holds, so a load can be told apart. */
  sand: { x: number; y: number }
}

function sceneJson(sand: { x: number; y: number }): string {
  const cells = new Uint8Array(GRID_WIDTH * GRID_HEIGHT * BYTES_PER_CELL)
  cells[(sand.y * GRID_WIDTH + sand.x) * BYTES_PER_CELL + SPECIES_OFFSET] = SAND
  const registry = createRegistry(v1Elements, v1Reactions)
  const envelope = encodeScene({ width: GRID_WIDTH, height: GRID_HEIGHT, cells }, [], registry, {
    edges: [],
    reviewed: 0,
  })
  return JSON.stringify(envelope)
}

/** Writes the scenes under the old unscoped keys. Call after a reload, before the app mounts. */
export async function seedLegacyScenes(page: Page, scenes: readonly LegacyScene[]): Promise<void> {
  const entries: [string, string][] = [
    [
      'silt:scenes',
      JSON.stringify(
        scenes.map(({ id, name }, i) => ({ id, name, updatedAt: 1_700_000_000_000 + i })),
      ),
    ],
  ]
  for (const scene of scenes) {
    entries.push([`silt:scene:${scene.id}`, sceneJson(scene.sand)])
    entries.push([`silt:thumb:${scene.id}`, ONE_PIXEL_PNG])
  }
  await page.evaluate((pairs) => {
    for (const [key, value] of pairs) window.localStorage.setItem(key, value)
  }, entries)
}

/** The old scene keys still in localStorage. */
export async function legacySceneKeys(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Object.keys(window.localStorage)
      .filter((key) => /^silt:(scenes|scene:|thumb:)/.test(key))
      .sort(),
  )
}
