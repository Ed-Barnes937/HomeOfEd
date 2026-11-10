// Refuses to let deployed infrastructure run on anything this public repo
// publishes (ADR 0078 decision 4, extracted by ADR 0088). Nothing here is ever logged.

export type Environment = Readonly<Record<string, string | undefined>>

/** What a placeholder looks like: the primary rule, since a list misses what nobody remembered. */
const PLACEHOLDER_SECRET = /dev-|insecure|change-?me|placeholder|example|^test/i

/** The belt to that pattern's braces; each app's env test re-reads its own files for drift. */
export const COMMITTED_DEV_SECRETS: readonly string[] = [
  'dev-insecure-invite',
  'dev-insecure-secret',
  'dev-invite-code',
  'dev-better-auth-secret',
  'dev-better-auth-secret-change-me',
  'dev-child-session-secret',
  'dev-child-session-secret-change-me',
  'dev-insecure-child-session-secret',
  'dev-pipeline-key',
]

const GENERATE = 'Generate one with: openssl rand -base64 32'

/** Fly injects FLY_APP_NAME into every machine, and no local stack sets it. */
export function isDeployed(env: Environment): boolean {
  return Boolean(env.FLY_APP_NAME)
}

/** On Fly only: refuses a missing, placeholder or short secret, and any NODE_ENV but production. */
export function assertFitForDeployment(
  env: Environment,
  minLengths: Readonly<Record<string, number>>,
): void {
  if (!isDeployed(env)) return

  for (const [name, minLength] of Object.entries(minLengths)) {
    const value = env[name]
    if (!value) {
      throw new Error(
        `${name} is required on deployed infrastructure (FLY_APP_NAME is set). ${GENERATE}`,
      )
    }
    if (PLACEHOLDER_SECRET.test(value) || COMMITTED_DEV_SECRETS.includes(value)) {
      throw new Error(
        `${name} reads as a placeholder, and this repo publishes several, so anyone who can ` +
          `read it may hold it. FLY_APP_NAME says this is deployed infrastructure. ${GENERATE}`,
      )
    }
    if (value.length < minLength) {
      throw new Error(
        `${name} must be at least ${minLength} characters on deployed infrastructure. ${GENERATE}`,
      )
    }
  }

  if (env.NODE_ENV !== 'production') {
    throw new Error(
      'NODE_ENV must be "production" on deployed infrastructure (FLY_APP_NAME is set): ' +
        'anything else can switch on development-only behaviour such as dev CORS origins, ' +
        'stack traces in error responses or insecure fallback secrets.',
    )
  }
}
