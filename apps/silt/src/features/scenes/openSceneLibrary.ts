import { openIndexedDbSceneRecords } from './indexedDbSceneRecords.ts'
import type { LegacyStorage } from './legacyScenes.ts'
import { BLOCKED_MESSAGE, CLOSED_MESSAGE, SceneLibrary } from './sceneLibrary.ts'
import { DEVICE_NAMESPACE, type SceneRecords } from './sceneRecords.ts'
import { persistWithoutPrompt } from './storagePersistence.ts'

/** Private browsing modes can make even *touching* a storage API throw. */
function deviceLocalStorage(): LegacyStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function openBrowserRecords(notice: (message: string) => void): Promise<SceneRecords> {
  try {
    return openIndexedDbSceneRecords({
      factory: window.indexedDB,
      onBlocked: () => notice(BLOCKED_MESSAGE),
      onClosed: () => notice(CLOSED_MESSAGE),
    })
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

/** The page's scenes in this browser's IndexedDB, for `player` (or the device when signed out). */
export function openSceneLibrary(player: string | null): SceneLibrary {
  return new SceneLibrary(openBrowserRecords, player ?? DEVICE_NAMESPACE, {
    legacy: deviceLocalStorage(),
    keepStorage: () => persistWithoutPrompt(navigator),
  })
}
