import { simulatorPlugin } from '@hoe/backend-kit/simulator'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { createSimulatorDispatch } from './src/server/simulator'

export default defineConfig({
  plugins: [react(), simulatorPlugin({ createDispatch: createSimulatorDispatch })],
})
