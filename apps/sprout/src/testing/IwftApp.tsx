// Browser side of the .iwft harness: pull the real backend (router + PGlite
// WASM + in-memory blobs) into the CT bundle and expose its dispatcher for the
// page.route trampoline. Module init runs once per test page = fresh DB per test.
//
// AUTH SEAM: sprout's handlers derive a ROLE ('parent'|'child') from ctx.auth,
// but the test-kit's shared `testUserAuth` only carries `user.id`. So this
// harness uses a sprout-specific seam that decodes the role from an ENCODED id
// (asParent/asChild in ./users.ts): 'parent:<id>' → parent, 'child:<id>:<pId>'
// → child. That keeps mountApp({ user }) type-correct ({ id: string }) while
// transporting the role the ownership checks need.
import {
  ConsoleLogger,
  createContext,
  createDispatcher,
  exposeDispatcher,
  InMemoryBlobStore,
  type AuthProvider,
} from '@hoe/backend-kit'
import { freshTestDb } from '@hoe/db'
import { applyPendingSeed } from '@hoe/test-kit/browser'

import { App } from '../App.tsx'
import type { SproutUser } from '../server/auth/providers.ts'
import { migrations } from '../server/migrations.ts'
import { createAppRouter } from '../server/router.ts'
import { sproutSchema } from '../server/schema.ts'
import { DrizzleSproutStore } from '../server/store.ts'
import { testHasher } from '../server/testing/testHasher.ts'

// Well-known header the test-kit trampoline sets from mountApp({ user }).
const TEST_USER_HEADER = 'x-hoe-test-user'

/** Decode the sprout role/identity from the encoded test-user id. */
function decodeSproutUser(raw: string): SproutUser | null {
  const [role, id, parentId] = raw.split(':')
  if (role === 'parent' && id) return { id, role: 'parent' }
  if (role === 'child' && id && parentId) return { id, role: 'child', parentId }
  return null
}

function sproutTestAuth(req: Request): AuthProvider {
  const raw = req.headers.get(TEST_USER_HEADER)
  const user = raw ? decodeSproutUser(raw) : null
  return { getUser: () => user }
}

exposeDispatcher(
  (async () => {
    const db = await applyPendingSeed(await freshTestDb(sproutSchema, migrations))
    const appRouter = createAppRouter({
      // Browser-safe hasher (scrypt can't run in the CT browser).
      hasher: testHasher,
      // No `.iwft` flow exercises the summariser (chat streaming is P5).
      summarise: () => Promise.reject(new Error('pipeline summariser not wired yet (P5)')),
      // Browser-safe fake minter — a deterministic non-crypto string. Child
      // identity in `.iwft` comes from the test-user header, not this token.
      mintChildToken: (claims) => `test-child-token:${claims.childId}`,
    })
    return createDispatcher({
      router: appRouter,
      createContext: createContext({
        store: new DrizzleSproutStore(db),
        blobs: new InMemoryBlobStore(),
        logger: new ConsoleLogger({ app: 'sprout', mode: 'iwft' }),
        auth: sproutTestAuth,
      }),
    })
  })(),
)

export function IwftApp() {
  return <App />
}
