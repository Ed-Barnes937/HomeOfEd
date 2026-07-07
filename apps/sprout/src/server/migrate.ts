// Deploy-time migrations: `node src/server/migrate.ts` (the fly.toml
// release_command). Journal-tracked run-once semantics — safe on every deploy.
import { fileURLToPath } from 'node:url'

import { loadDbEnv } from '@hoe/db/env'
import { migratePostgres } from '@hoe/db/node'
import { createLogger } from '@hoe/logger'

const logger = createLogger().child({ app: 'sprout', task: 'migrate' })
const env = loadDbEnv()

await migratePostgres(env.DATABASE_URL, fileURLToPath(new URL('./migrations', import.meta.url)))
logger.info('migrations applied')
