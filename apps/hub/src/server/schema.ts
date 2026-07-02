import { pgTable, serial, text } from 'drizzle-orm/pg-core'

export const healthTable = pgTable('health', {
  id: serial('id').primaryKey(),
  value: text('value').notNull(),
})

export const hubSchema = { health: healthTable }
export type HubSchema = typeof hubSchema
