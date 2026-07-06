// scrypt password/PIN hashing (plan §13 — ports nearly unchanged). Adjusted to
// repo lint only (no semicolons, single quotes). Used by childAuth (P3b) and
// child creation/update (children group).
//
// node:crypto is Node-ONLY (scrypt has no WebCrypto equivalent). Handlers must
// NOT import the concrete functions directly — they'd drag node:crypto into the
// browser `.iwft` bundle (which runs the real router over PGlite-WASM). Instead
// handlers depend on the `PasswordHasher` port (type-only, erased) and the
// composition root injects the concrete `scryptHasher` (Node) or a browser-safe
// fake (the `.iwft` harness). See router/deps.ts + testing/testHasher.ts.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const KEY_LENGTH = 64
const SALT_BYTES = 16

/**
 * Hashes a secret (a child's PIN or password) with scrypt and a random
 * per-secret salt. Returns a "<saltHex>:<hashHex>" string suitable for storing
 * in the existing `text` password/PIN columns.
 */
export const hashSecret = (plain: string): string => {
  if (typeof plain !== 'string') {
    throw new TypeError('hashSecret: secret must be a string')
  }
  const salt = randomBytes(SALT_BYTES).toString('hex')
  const hash = scryptSync(plain, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

/**
 * Verifies a plaintext secret against a stored "<saltHex>:<hashHex>" value
 * using a constant-time comparison. Returns false for any malformed stored
 * value (e.g. legacy plaintext rows from before hashing was introduced).
 */
export const verifySecret = (plain: string, stored: string): boolean => {
  // Guard non-string input (e.g. a JSON body sending a number/undefined for the
  // PIN) — scryptSync throws on non-string/Buffer, which would otherwise surface
  // as a 500 on an unauthenticated login endpoint instead of a clean failure.
  if (typeof plain !== 'string' || typeof stored !== 'string') return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  if (expected.length !== KEY_LENGTH) return false
  const actual = scryptSync(plain, salt, KEY_LENGTH)
  return timingSafeEqual(expected, actual)
}

/**
 * The hashing port handlers depend on (inject at the composition root). Keeping
 * this an interface + injected impl is what keeps node:crypto out of the browser
 * bundle while letting the `.iwft` harness swap in a browser-safe fake.
 */
export interface PasswordHasher {
  hash(plain: string): string
  verify(plain: string, stored: string): boolean
}

/** The production/dev hasher (scrypt). Imported only by Node composition roots. */
export const scryptHasher: PasswordHasher = { hash: hashSecret, verify: verifySecret }
