// Conventions shared by the Node side (mountApp / page.route trampoline) and
// the browser side (the app's .iwft harness). Browser-safe: no Playwright.
import type { User } from '@hoe/backend-kit'

/** window key where mountApp stashes the serialised SeedFn before mounting. */
export const SEED_SOURCE_KEY = '__hoeSeedSource'

/**
 * Well-known header carrying the test user's id. mountApp({ user }) sets it
 * on every trampolined tRPC request; the harness's `testUserAuth` reads it
 * back into the AppContext.auth seam.
 */
export const TEST_USER_HEADER = 'x-hoe-test-user'

/** Headers the trampoline adds for the injected test user (empty when anonymous). */
export function testUserHeaders(user: User | null): Record<string, string> {
  return user ? { [TEST_USER_HEADER]: user.id } : {}
}
