// The T1.1-frozen mountApp contract shapes. Browser-safe (types only).
import type { FailureRule, User } from '@hoe/backend-kit'
import type { DbClient, DbSchema } from '@hoe/db'
import type { Page } from '@playwright/test'

import type { BasePage } from './pom.ts'

/**
 * Frozen: runs against the test DbClient (schema-agnostic — use raw SQL via
 * `db.execute(...)`). Serialised with `fn.toString()` to cross the
 * Node→browser boundary, so it must be self-contained: no closures over test
 * scope, no imports — the `db` parameter is all it gets.
 */
export type SeedFn = (db: DbClient<DbSchema>) => Promise<void>

/** Frozen: what an .iwft test receives back from mountApp. */
export interface MountedApp {
  page: Page
  root: BasePage
}

/** Frozen option names/types of the mountApp fixture. */
export interface MountAppOpts {
  seed?: SeedFn
  failures?: FailureRule[]
  user?: User | null
}
