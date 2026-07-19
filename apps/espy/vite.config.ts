import { simulatorPlugin } from '@hoe/backend-kit/simulator'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { createSimulatorDispatch } from './src/server/simulator'

export default defineConfig({
  // Relative asset URLs so the same dist/ loads under the Capacitor WebView's
  // capacitor://-style origin as well as https:// (ADR 0017 consequences).
  base: '',
  plugins: [react(), simulatorPlugin({ createDispatch: createSimulatorDispatch })],
})
