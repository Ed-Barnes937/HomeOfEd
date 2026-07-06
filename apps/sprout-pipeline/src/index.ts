// Headless LLM safety pipeline service — a separate Fly app with no SPA and no
// database (ADR 0008; plan 0004 §5.5, D7). Bare Fastify, not `createAppServer`.
//
// P0: a minimal green skeleton — only a shallow `/health` liveness check. The
// safety modules and orchestrator (ported Hono → Fastify) arrive in P6.
import { fileURLToPath } from 'node:url'

import { createLogger } from '@hoe/logger'
import Fastify, { type FastifyInstance } from 'fastify'

export function buildServer(): FastifyInstance {
  const app = Fastify()
  // Shallow health: this service owns no Store, so `/health` is pure liveness
  // (ADR 0008).
  app.get('/health', () => ({ ok: true as const }))
  return app
}

// Start listening only when run as the entrypoint (`node src/index.ts`), not
// when imported (e.g. by the test).
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const logger = createLogger().child({ app: 'sprout-pipeline' })
  const app = buildServer()
  const port = Number(process.env.PORT ?? 8080)
  await app.listen({ port, host: '0.0.0.0' })
  logger.info('sprout-pipeline listening', { port })
}
