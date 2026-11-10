import { readFamilySession } from './readFamilySession.ts'

type Listenable = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

export interface PlayerChangeEnv {
  window: Listenable
  document: Listenable & { visibilityState: string }
  /** The account signed in now; `readFamilySession()?.sub` by default. */
  current: () => string | null
  reload: () => void
}

/** Reload when the page returns to view (`pageshow` incl. bfcache, visible `visibilitychange`, `focus`)
 *  with another profile signed in than `openedFor`, or none. Returns a function that stops watching. */
export function reloadOnPlayerChange(
  openedFor: string | null,
  env: PlayerChangeEnv = browserEnv(),
): () => void {
  const check = () => {
    if (env.current() !== openedFor) env.reload()
  }
  const onVisibility = () => {
    if (env.document.visibilityState === 'visible') check()
  }
  env.window.addEventListener('pageshow', check)
  env.window.addEventListener('focus', check)
  env.document.addEventListener('visibilitychange', onVisibility)
  return () => {
    env.window.removeEventListener('pageshow', check)
    env.window.removeEventListener('focus', check)
    env.document.removeEventListener('visibilitychange', onVisibility)
  }
}

function browserEnv(): PlayerChangeEnv {
  const scope = globalThis as unknown as {
    document: PlayerChangeEnv['document']
    location: { reload: () => void }
  }
  return {
    window: globalThis as unknown as Listenable,
    document: scope.document,
    current: () => readFamilySession()?.sub ?? null,
    reload: () => scope.location.reload(),
  }
}
