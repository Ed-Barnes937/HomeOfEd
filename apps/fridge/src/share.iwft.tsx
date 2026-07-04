import { test } from './testing/iwftTest.tsx'

const SEED_ID = 'SeedBoard1'

test('opening a shared link imports it as a new local fridge', async ({ mountApp }) => {
  const { root } = await mountApp({
    // Self-contained (serialised across the Node→browser boundary via
    // fn.toString()): no imports, just raw SQL through `db`. Payload is a valid
    // StoredBoard ("HI"); w/h/z/id are recomputed on import so it omits them.
    seed: async (db) => {
      await db.execute(
        `insert into shared_boards (id, name, payload) values ('SeedBoard1', 'Shared Hello', '{"name":"Shared Hello","finish":"mint","wall":"warm","magnets":[{"type":"letter","label":"H","deg":0,"color":"red","x":300,"y":60,"rot":0},{"type":"letter","label":"I","deg":0,"color":"blue","x":360,"y":60,"rot":0}]}'::jsonb)`,
      )
    },
  })
  await root.gotoSharedBoard(SEED_ID)
  // The route imports the board and redirects to '/', where it shows as the
  // current board with an active saved chip.
  await root.verifyPathIsRoot()
  await root.verifyIsShown()
  await root.verifyMagnetCount(2)
  await root.verifyNameInputValue('Shared Hello (shared)')
  await root.verifyActiveChip('Shared Hello (shared)')
})

test('sharing the current board surfaces a /b/ link', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.clickShare()
  await root.verifyShareUrlShown()
})

test('a shared link round-trips through the server back to the same board', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.verifyIsShown()
  await root.setNameInput('Poem')
  await root.clickShare()
  // Follow the very link we just minted: board.share → board.get through the
  // simulator's real router + PGlite, then import.
  const id = await root.readShareId()
  await root.gotoSharedBoard(id)
  await root.verifyPathIsRoot()
  await root.verifyMagnetCount(8) // the seed board's magnets, recomputed on import
  await root.verifyNameInputValue('Poem (shared)')
  await root.verifyActiveChip('Poem (shared)')
})

test('an unknown shared id shows the not-found state', async ({ mountApp }) => {
  const { root } = await mountApp()
  await root.gotoSharedBoard('Missing00x') // valid 10-char shape, absent from the DB
  await root.verifySharedNotFound()
})
