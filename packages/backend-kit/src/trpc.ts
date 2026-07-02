import { initTRPC } from '@trpc/server'

import type { AppContext } from './context.ts'

/**
 * Per-app tRPC instance bound to the app's AppContext<Store>.
 *
 * `allowOutsideOfServer` is deliberate: the .iwft harness runs this same
 * router inside the browser (over PGlite-WASM), which tRPC guards against by
 * default. Production still runs it server-side — the flag only disables the
 * environment check (validated in the T1.1 spike).
 */
export function createTRPC<Store>() {
  return initTRPC.context<AppContext<Store>>().create({ allowOutsideOfServer: true })
}
