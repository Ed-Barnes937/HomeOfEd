import { createTRPCClient, httpBatchLink } from '@trpc/client'

import type { AppRouter } from './server/router.ts'

export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: '/api/trpc' })],
})
