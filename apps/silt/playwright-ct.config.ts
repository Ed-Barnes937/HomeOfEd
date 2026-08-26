import { defineIwftConfig } from '@hoe/test-kit/ct-config'

// crossOriginIsolated matches production (COOP/COEP from the app server), so
// the suites exercise the sim worker — the mode users actually get.
export default defineIwftConfig({ ctPort: 3109, crossOriginIsolated: true })
