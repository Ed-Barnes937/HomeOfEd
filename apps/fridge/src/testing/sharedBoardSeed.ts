import type { SeedFn } from '@hoe/test-kit'

export const SHARED_ID = 'SeedBoard1'

/**
 * A shared "HI" board under SHARED_ID. Self-contained, because it crosses to the
 * browser as source text: no imports or outer names inside the body.
 */
export const seedSharedHello: SeedFn = async (db) => {
  await db.execute(
    `insert into shared_boards (id, name, payload) values ('SeedBoard1', 'Shared Hello', '{"name":"Shared Hello","finish":"mint","wall":"warm","magnets":[{"type":"letter","label":"H","deg":0,"color":"red","x":300,"y":60,"rot":0},{"type":"letter","label":"I","deg":0,"color":"blue","x":360,"y":60,"rot":0}]}'::jsonb)`,
  )
}
