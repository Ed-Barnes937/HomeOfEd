import { simulatorPlugin } from '@hoe/backend-kit/simulator'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { createSimulatorDispatch } from './src/server/simulator'

export default defineConfig({
  plugins: [react(), simulatorPlugin({ createDispatch: createSimulatorDispatch })],
  // three.js lives in the lazily loaded stage chunk, which is ~1 MB on its own (ADR 0073).
  build: { chunkSizeWarningLimit: 1100 },
})
