// drizzle-kit config for this package's OWN test schema. Apps copy this shape
// (schema/out paths point at the app's own schema + migrations folder).
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/testing/schema.ts',
  out: './src/testing/migrations',
})
