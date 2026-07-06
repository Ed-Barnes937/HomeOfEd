// A browser-safe PasswordHasher for the `.iwft` harness (scrypt can't run in a
// browser). NOT cryptographic — a reversible marker good enough to exercise the
// hash/verify round-trip in whole-frontend tests. Node handler unit tests inject
// the real `scryptHasher` instead. Imports only the type from password.ts
// (erased), so this file never pulls node:crypto into the browser bundle.
import type { PasswordHasher } from '../password.ts'

export const testHasher: PasswordHasher = {
  hash: (plain) => `test:${plain}`,
  verify: (plain, stored) => stored === `test:${plain}`,
}
