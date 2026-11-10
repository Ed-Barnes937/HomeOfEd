import type { KeyObject } from 'node:crypto'
import { createPublicKey } from 'node:crypto'

import type { Environment } from '@hoe/deploy-guard'

import { readFamilyTokenFromCookieHeader } from './claims.ts'
import { verifyFamilyToken } from './familyToken.ts'
import { familyVerifyingKey, PRODUCTION_FAMILY_PUBLIC_KEY } from './familyVerifyingKey.ts'
import { accountUrl } from './returnTo.ts'

// Structurally the `documentGate` option of backend-kit's `createAppServer`.
interface DocumentGateRequest {
  host: string
  url: string
  cookie: string | null
}

interface DocumentGate {
  publicPaths: readonly string[]
  redirectFor: (req: DocumentGateRequest) => string | null
}

export interface FamilyDocumentGateOpts {
  /** `FAMILY_ACCOUNT_URL`, hub's account page. */
  accountUrl: string
  /** Path prefixes served without a session, such as `/shared`. */
  publicPaths: readonly string[]
  publicKeyPem: string
  now?: () => Date
}

/**
 * Lets through any verified family token; anything else goes to the account page.
 * Bad config throws here, at boot, rather than failing every request.
 */
export function familyDocumentGate(opts: FamilyDocumentGateOpts): DocumentGate {
  const accountBase = parseAccountUrl(opts.accountUrl)
  const publicKey = parsePublicKey(opts.publicKeyPem)
  const now = opts.now ?? (() => new Date())
  return {
    publicPaths: opts.publicPaths,
    redirectFor: (req) => {
      const token = readFamilyTokenFromCookieHeader(req.cookie)
      if (token !== null && verifyFamilyToken(token, publicKey, now) !== null) return null
      const returnTo = requestUrl(req.host, req.url)
      return returnTo === null ? accountBase : accountUrl(accountBase, returnTo)
    },
  }
}

/**
 * What an app's `main.ts` passes as `documentGate`: off (`undefined`) unless
 * `FAMILY_ACCOUNT_URL` is set, so the verifying key is only resolved when on.
 */
export function familyDocumentGateFromEnv(
  env: Environment,
  opts: Pick<FamilyDocumentGateOpts, 'publicPaths' | 'now'>,
): DocumentGate | undefined {
  const familyAccountUrl = env.FAMILY_ACCOUNT_URL
  if (!familyAccountUrl) return undefined
  return familyDocumentGate({
    ...opts,
    accountUrl: familyAccountUrl,
    publicKeyPem: familyVerifyingKey(env, PRODUCTION_FAMILY_PUBLIC_KEY),
  })
}

function parseAccountUrl(raw: string): string {
  let url: URL | null = null
  try {
    url = new URL(raw)
  } catch {
    // reported below
  }
  if (url === null || (url.protocol !== 'https:' && url.protocol !== 'http:'))
    throw new Error(`familyDocumentGate: accountUrl must be an absolute http(s) URL, got '${raw}'`)
  return url.href
}

// Exactly one block: OpenSSL itself skips text before and after it.
const ONE_PUBLIC_PEM =
  /^\s*-----BEGIN PUBLIC KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END PUBLIC KEY-----\s*$/

function parsePublicKey(pem: string): KeyObject {
  if (!pem) throw new Error('familyDocumentGate: publicKeyPem is required')
  if (pem.includes('PRIVATE KEY'))
    throw new Error('familyDocumentGate: publicKeyPem holds a private key; pass the public half')
  let key: KeyObject | null = null
  try {
    if (ONE_PUBLIC_PEM.test(pem)) key = createPublicKey(pem)
  } catch {
    // reported below
  }
  if (key === null) throw new Error('familyDocumentGate: publicKeyPem is not a PEM public key')
  if (key.asymmetricKeyType !== 'ed25519')
    throw new Error('familyDocumentGate: publicKeyPem must be an Ed25519 key')
  return key
}

// Null when the Host header or request target would build a URL on another host.
function requestUrl(host: string, path: string): string | null {
  if (host === '' || !path.startsWith('/')) return null
  const scheme = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? 'http' : 'https'
  let url: URL
  try {
    url = new URL(`${scheme}://${host}${path}`)
  } catch {
    return null
  }
  if (url.username !== '' || url.password !== '' || url.host !== host.toLowerCase()) return null
  return url.href
}
