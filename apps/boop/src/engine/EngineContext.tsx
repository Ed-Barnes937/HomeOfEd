import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

import type { AudioDriver } from './audioDriver.ts'
import { createSequencerEngine } from './createSequencerEngine.ts'
import { LAUNCH_KIT_URL, loadKit } from './kitManifest.ts'
import type { SequencerEngine } from './sequencerEngine.ts'

const EngineContext = createContext<SequencerEngine | null>(null)

interface EngineProviderProps {
  /** The AudioDriver to build the engine over — `ToneAudioDriver` in prod, `FakeAudioDriver` in .iwft. */
  driver: AudioDriver
  children: ReactNode
}

/**
 * Loads the launch kit and builds the `SequencerEngine` over the injected
 * driver, so the first cell tap is audible once it's ready. `null` while
 * loading — there is exactly one kit in V1, so there is no error UI beyond
 * that (a failed fetch surfaces in the console, same as any other asset 404).
 */
export function EngineProvider({ driver, children }: EngineProviderProps) {
  const [engine, setEngine] = useState<SequencerEngine | null>(null)

  useEffect(() => {
    let cancelled = false
    let created: SequencerEngine | null = null
    void (async () => {
      const kit = await loadKit(LAUNCH_KIT_URL)
      const built = await createSequencerEngine({ kit, driver })
      if (cancelled) {
        built.dispose()
        return
      }
      created = built
      setEngine(built)
    })()
    return () => {
      cancelled = true
      created?.dispose()
    }
  }, [driver])

  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>
}

/** The loaded engine, or `null` before the kit has finished loading. */
export function useEngine(): SequencerEngine | null {
  return useContext(EngineContext)
}
