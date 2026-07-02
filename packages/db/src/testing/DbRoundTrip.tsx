// CT-only component: runs a full migrate → insert → select round-trip on an
// in-browser PGlite and renders the result. Loads the generated migrations
// with the documented browser pattern (Vite raw glob → migrationsFromFiles).
import { useEffect, useState } from 'react'

import { freshTestDb, migrationsFromFiles } from '../index.ts'
import * as schema from './schema.ts'

const sqlFiles = import.meta.glob<string>('./migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const migrations = migrationsFromFiles(sqlFiles)

export function DbRoundTrip() {
  const [value, setValue] = useState('pending')
  useEffect(() => {
    freshTestDb(schema, migrations)
      .then(async (db) => {
        await db.insert(schema.items).values({ name: 'hello from browser pglite' })
        const rows = await db.select().from(schema.items)
        setValue(rows[0]?.name ?? 'missing')
      })
      .catch((error: unknown) => {
        setValue(`error: ${String(error)}`)
      })
  }, [])
  return <output data-testid="db-roundtrip">{value}</output>
}
