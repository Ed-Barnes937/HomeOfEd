import { simulatorPlugin } from '@hoe/backend-kit/simulator'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { createSimulatorDispatch } from './src/server/simulator'

// COOP/COEP make the page cross-origin isolated, which is what unlocks
// SharedArrayBuffer for the sim worker (120fps ticket 02). Production sends
// the same pair from the app server (src/server/headers.ts); silt loads no
// cross-origin assets, so nothing is blocked by them.
const crossOriginIsolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [react(), simulatorPlugin({ createDispatch: createSimulatorDispatch })],
  server: { headers: crossOriginIsolation },
  preview: { headers: crossOriginIsolation },
})
