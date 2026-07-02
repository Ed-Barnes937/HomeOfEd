// Browser side of the .iwft harness: pull the real backend (router + PGlite
// WASM + in-memory blobs) into the CT bundle and expose its dispatcher for the
// page.route trampoline. Module init runs once per test page = fresh DB per test.
import { exposeDispatcher } from '@hoe/backend-kit'

import { App } from '../App.tsx'
import { createSimulatorDispatch } from '../server/simulator.ts'

exposeDispatcher(createSimulatorDispatch())

export function IwftApp() {
  return <App />
}
