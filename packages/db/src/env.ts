// Typed environment for the database layer. Node-only (defaults to reading
// process.env) — exposed as `@hoe/db/env` so it never enters browser bundles.
// Parse ONCE at startup (the app's server entrypoint) and pass the result
// down; don't sprinkle process.env reads through the codebase.
import { z } from 'zod'

export const dbEnvSchema = z.object({
  /** Postgres connection string, e.g. postgres://user:pass@host:5432/dbname */
  DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .describe('Postgres connection string (postgres://…)'),
})

export type DbEnv = z.infer<typeof dbEnvSchema>

/**
 * Validate the database environment. Throws with a readable message listing
 * every problem — fail fast at boot, not on the first query.
 */
export function loadDbEnv(source: Record<string, string | undefined> = process.env): DbEnv {
  const parsed = dbEnvSchema.safeParse(source)
  if (!parsed.success) {
    throw new Error(`Invalid database environment:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}
