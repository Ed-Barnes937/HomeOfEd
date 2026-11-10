import { readFamilyTokenFromCookieHeader } from './claims.ts'
import { verifyFamilyToken } from './familyToken.ts'
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

/** Lets through any verified family token; anything else goes to the account page. */
export function familyDocumentGate(opts: FamilyDocumentGateOpts): DocumentGate {
  if (!opts.publicKeyPem) throw new Error('familyDocumentGate: publicKeyPem is required')
  const now = opts.now ?? (() => new Date())
  return {
    publicPaths: opts.publicPaths,
    redirectFor: (req) => {
      const token = readFamilyTokenFromCookieHeader(req.cookie)
      if (token !== null && verifyFamilyToken(token, opts.publicKeyPem, now) !== null) return null
      const returnTo = requestUrl(req.host, req.url)
      return returnTo === null ? opts.accountUrl : accountUrl(opts.accountUrl, returnTo)
    },
  }
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
