// In-page half of the .iwft harness, imported by an app's harness module
// (runs in the CT browser bundle — no Playwright imports here).
import type { AuthProvider } from '@hoe/backend-kit'
import type { DbClient, DbSchema } from '@hoe/db'

import { SEED_SOURCE_KEY, TEST_USER_HEADER } from './protocol.ts'
import type { SeedFn } from './types.ts'

/**
 * Run the seed mountApp({ seed }) stashed on `window` (if any) against the
 * harness's freshly migrated DbClient. Call it between creating the test db
 * and exposing the dispatcher, so seeding always precedes the app's first
 * query. Returns the same db for chaining.
 */
export async function applyPendingSeed<S extends DbSchema>(db: DbClient<S>): Promise<DbClient<S>> {
  const source = (globalThis as Record<string, unknown>)[SEED_SOURCE_KEY]
  if (typeof source === 'string') {
    // The SeedFn crossed the Node→browser boundary as source text
    // (fn.toString()), so it must be self-contained — see the README.
    // Deliberate eval-of-source: that IS the transport mechanism here.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
    const seed = new Function(`return (${source})`)() as SeedFn
    await seed(db)
  }
  return db
}

/**
 * The test-auth seam: an app's .iwft harness passes this as the `auth` dep of
 * createContext. It reads the well-known header set by mountApp({ user }) —
 * absent header = anonymous, matching production's default.
 */
export function testUserAuth(req: Request): AuthProvider {
  const id = req.headers.get(TEST_USER_HEADER)
  return { getUser: () => (id ? { id } : null) }
}
