// A minimal but complete fixture app (schema -> Store -> handlers -> router)
// used by the kit's own tests. Deliberately mirrors how a real app wires
// itself (see apps/hub): handlers depend on the NotesStore interface only,
// so the real Drizzle impl and the in-memory fake are interchangeable.
import { freshTestDb, type DbClient } from '@hoe/db'
import { eq } from 'drizzle-orm'
import { pgTable, serial, text } from 'drizzle-orm/pg-core'

import { InMemoryBlobStore } from '../blobs.ts'
import { createContext, type AppContext } from '../context.ts'
import { createDispatcher, type Dispatch } from '../dispatch.ts'
import { NotFoundError, ValidationError } from '../errors.ts'
import { Handler } from '../handler.ts'
import { createTRPC } from '../trpc.ts'
import { NoopLogger } from './noopLogger.ts'

export const notesTable = pgTable('notes', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
})
export const fixtureSchema = { notes: notesTable }
export type FixtureSchema = typeof fixtureSchema
export const fixtureMigrations: readonly string[] = [
  `create table if not exists notes (id serial primary key, title text not null)`,
]

export type Note = { id: number; title: string }

export interface NotesStore {
  add(title: string): Promise<Note>
  byId(id: number): Promise<Note | null>
}

/** The "real" side: Drizzle over an injected DbClient (Postgres or PGlite). */
export class DrizzleNotesStore implements NotesStore {
  private readonly db: DbClient<FixtureSchema>

  constructor(db: DbClient<FixtureSchema>) {
    this.db = db
  }

  async add(title: string): Promise<Note> {
    const rows = await this.db.insert(notesTable).values({ title }).returning()
    if (!rows[0]) throw new Error('insert returned no row')
    return rows[0]
  }
  async byId(id: number): Promise<Note | null> {
    const rows = await this.db.select().from(notesTable).where(eq(notesTable.id, id))
    return rows[0] ?? null
  }
}

/** The fake side: same interface, plain memory. */
export class InMemoryNotesStore implements NotesStore {
  private readonly notes = new Map<number, Note>()
  private nextId = 1

  add(title: string): Promise<Note> {
    const note = { id: this.nextId++, title }
    this.notes.set(note.id, note)
    return Promise.resolve(note)
  }
  byId(id: number): Promise<Note | null> {
    return Promise.resolve(this.notes.get(id) ?? null)
  }
}

export class AddNoteHandler extends Handler<string, Note, NotesStore> {
  run(input: string, ctx: AppContext<NotesStore>): Promise<Note> {
    return ctx.store.add(input)
  }
}

export class GetNoteHandler extends Handler<number, Note, NotesStore> {
  async run(input: number, ctx: AppContext<NotesStore>): Promise<Note> {
    if (!Number.isInteger(input) || input < 1) {
      throw new ValidationError(`note id must be a positive integer, got ${input}`)
    }
    const note = await ctx.store.byId(input)
    if (!note) throw new NotFoundError(`note ${input} not found`)
    return note
  }
}

const parseString = (value: unknown): string => {
  if (typeof value !== 'string') throw new ValidationError('expected a string')
  return value
}
const parseNumber = (value: unknown): number => {
  if (typeof value !== 'number') throw new ValidationError('expected a number')
  return value
}

const t = createTRPC<NotesStore>()

export const fixtureRouter = t.router({
  addNote: t.procedure
    .input(parseString)
    .mutation(({ input, ctx }) => new AddNoteHandler().run(input, ctx)),
  getNote: t.procedure
    .input(parseNumber)
    .query(({ input, ctx }) => new GetNoteHandler().run(input, ctx)),
})
export type FixtureRouter = typeof fixtureRouter

export function fixtureContext(store: NotesStore): (req: Request) => AppContext<NotesStore> {
  return createContext({ store, blobs: new InMemoryBlobStore(), logger: new NoopLogger() })
}

export function fixtureDispatch(store: NotesStore): Dispatch {
  return createDispatcher({ router: fixtureRouter, createContext: fixtureContext(store) })
}

/** A fresh real store: Drizzle over a brand-new migrated PGlite. */
export async function freshDrizzleNotesStore(): Promise<NotesStore> {
  return new DrizzleNotesStore(await freshTestDb(fixtureSchema, fixtureMigrations))
}
