import { describe, expect, it } from 'vitest'

import { InMemoryBlobStore } from './blobs.ts'
import type { AppContext } from './context.ts'
import { NotFoundError, ValidationError } from './errors.ts'
import {
  AddNoteHandler,
  freshDrizzleNotesStore,
  GetNoteHandler,
  InMemoryNotesStore,
  type NotesStore,
} from './testSupport/fixtureApp.ts'
import { NoopLogger } from './testSupport/noopLogger.ts'

function makeCtx(store: NotesStore): AppContext<NotesStore> {
  return {
    store,
    blobs: new InMemoryBlobStore(),
    auth: { getUser: () => null },
    now: () => new Date('2026-01-01T00:00:00Z'),
    logger: new NoopLogger(),
  }
}

/**
 * The DI acceptance pin: the same handlers, run once against the real
 * Drizzle store (PGlite-backed) and once against the in-memory fake, behave
 * identically. Only the injected Store differs.
 */
describe.each([
  { impl: 'real (Drizzle over PGlite)', makeStore: freshDrizzleNotesStore },
  { impl: 'fake (in-memory)', makeStore: () => Promise.resolve(new InMemoryNotesStore()) },
])('handlers against the $impl store', ({ makeStore }) => {
  it('adds then reads back a note', async () => {
    const ctx = makeCtx(await makeStore())

    const added = await new AddNoteHandler().run('buy milk', ctx)
    expect(added).toEqual({ id: 1, title: 'buy milk' })

    const got = await new GetNoteHandler().run(added.id, ctx)
    expect(got).toEqual(added)
  })

  it('throws NotFoundError for a missing note', async () => {
    const ctx = makeCtx(await makeStore())

    await expect(new GetNoteHandler().run(42, ctx)).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws ValidationError for a non-positive id', async () => {
    const ctx = makeCtx(await makeStore())

    await expect(new GetNoteHandler().run(0, ctx)).rejects.toBeInstanceOf(ValidationError)
  })
})
