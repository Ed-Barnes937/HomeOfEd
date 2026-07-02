// Node-side entry, imported by test files and app fixture files.
// In-page harness helpers live at '@hoe/test-kit/browser'.
export { createIwftTest, type IwftAppDefinition, type MountApp } from './mountApp.ts'
export { BasePage } from './pom.ts'
export { TEST_USER_HEADER } from './protocol.ts'
export { installTrpcRoute, routeTrpcToPage, type TrpcRouteOptions } from './routeTrpc.ts'
export type { MountAppOpts, MountedApp, SeedFn } from './types.ts'
