import { createTRPCClient, httpBatchLink } from '@trpc/client'

import type { AppRouter } from './server/router.ts'

/**
 * The app's only tRPC caller (share/import — ADR 0010). Hits `/api/trpc`,
 * which is served by `createAppServer` in prod, the simulator plugin in dev,
 * and the page.route trampoline in .iwft. Mirrors hub's `trpcClient.ts`.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
})
