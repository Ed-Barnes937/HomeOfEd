// Evidence for the README's "Postgres features apps may rely on" list, run on
// PGlite so the PGlite-vs-real-Postgres fidelity gap is bounded by evidence,
// not assumption. The identical suite runs against real Postgres in
// postgres.test.ts when TEST_DATABASE_URL is set.
import { freshTestDb } from './index.ts'
import { loadMigrationsFromDir } from './node.ts'
import { describePgFeatures } from './testing/featureSuite.ts'
import * as schema from './testing/schema.ts'

const migrations = await loadMigrationsFromDir(
  new URL('./testing/migrations', import.meta.url).pathname,
)

describePgFeatures('PG features on PGlite', () => freshTestDb(schema, migrations))
