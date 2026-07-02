// Prod-shaped fixture entry, bundled by prodBundle.test.ts. The driver is NOT
// statically known here (worst case for tree-shaking — a literal 'postgres'
// at the call site lets rollup drop the pglite branch on its own), so the
// assertion proves the documented `external` pattern works even when nothing
// can be tree-shaken.
import { createDbClient, type CreateDbClientOpts, type DbClient, type DbSchema } from '../index.ts'

export function connect(opts: CreateDbClientOpts<DbSchema>): Promise<DbClient<DbSchema>> {
  return createDbClient(opts)
}
