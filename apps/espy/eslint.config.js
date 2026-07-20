import { baseConfig } from '@hoe/config/eslint'

export default [
  // Capacitor native projects (ADR 0017 §7) — includes a synced copy of dist/.
  { ignores: ['ios/', 'android/'] },
  ...baseConfig,
]
