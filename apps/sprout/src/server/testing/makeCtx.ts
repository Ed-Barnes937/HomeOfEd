// makeCtx — the AppContext<SproutStore> builder for handler unit tests. Defaults
// to a FakeSproutStore + an anonymous auth stub; pass `user` to authenticate as
// a parent or child (the whole point of the ownership tests), or `auth` to
// supply a provider directly. `now` is fixed so time-dependent handlers are
// deterministic. The logger is silent by default to keep test output clean.
import type { AppContext, AuthProvider, Logger } from '@hoe/backend-kit'
import { InMemoryBlobStore } from '@hoe/backend-kit'

import type { ChildUser, ParentUser, SproutUser } from '../auth/providers.ts'
import type { SproutStore } from '../store.ts'
import { FakeSproutStore } from './fakeSproutStore.ts'

const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  child: () => silentLogger,
}

export interface MakeCtxOptions {
  store?: SproutStore
  /** Authenticate as this user. Ignored if `auth` is given. Defaults to anonymous. */
  user?: SproutUser | null
  /** Full provider override (takes precedence over `user`). */
  auth?: AuthProvider
  now?: () => Date
  logger?: Logger
}

export function makeCtx(opts: MakeCtxOptions = {}): AppContext<SproutStore> {
  const user = opts.user ?? null
  const auth: AuthProvider = opts.auth ?? { getUser: () => user }
  return {
    store: opts.store ?? new FakeSproutStore(opts.now),
    blobs: new InMemoryBlobStore(),
    auth,
    now: opts.now ?? (() => new Date('2026-01-01T00:00:00Z')),
    logger: opts.logger ?? silentLogger,
  }
}

/** Convenience: a parent identity for `makeCtx({ user: parentUser('p1') })`. */
export const parentUser = (id: string): ParentUser => ({ id, role: 'parent' })

/** Convenience: a child identity carrying its owning parent. */
export const childUser = (id: string, parentId: string): ChildUser => ({
  id,
  role: 'child',
  parentId,
})
