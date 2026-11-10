// The secrets sprout's two Node entrypoints read, checked ONCE at boot so a bad
// value crashes the deploy instead of failing the first request. Never logged.
import { assertFitForDeployment, type Environment } from '@hoe/deploy-guard'

/** Each signs or authorises something; the invite code is typed by hand (ADR 0088). */
const MIN_DEPLOYED_LENGTH = {
  BETTER_AUTH_SECRET: 32,
  CHILD_SESSION_SECRET: 32,
  PIPELINE_API_KEY: 32,
  REGISTRATION_INVITE_CODE: 16,
} as const

export interface SproutWebEnv {
  /** Signs parent (Better Auth) cookie sessions. */
  BETTER_AUTH_SECRET: string | undefined
  /** Signs the child-session token; independent of the parent secret (plan §5.2). */
  CHILD_SESSION_SECRET: string
  /** Sent as x-pipeline-key to hoe-sprout-pipeline over the private network. */
  PIPELINE_API_KEY: string
  /** ADR-0019 family-pilot gate, required in production until public launch. */
  REGISTRATION_INVITE_CODE: string | undefined
}

export interface SproutWorkerEnv {
  PIPELINE_API_KEY: string
}

function pipelineApiKey(source: Environment): string {
  const key = source.PIPELINE_API_KEY
  if (key) return key
  if (source.NODE_ENV === 'production') {
    throw new Error('PIPELINE_API_KEY is required in production')
  }
  return 'dev-pipeline-key'
}

/** The web process (main.ts). On Fly, nothing this repo publishes may pass. */
export function loadSproutWebEnv(source: Environment = process.env): SproutWebEnv {
  assertFitForDeployment(source, MIN_DEPLOYED_LENGTH)

  const childSessionSecret = source.CHILD_SESSION_SECRET
  if (!childSessionSecret) {
    throw new Error('CHILD_SESSION_SECRET is required')
  }

  const registrationInviteCode = source.REGISTRATION_INVITE_CODE
  if (!registrationInviteCode && source.NODE_ENV === 'production') {
    throw new Error('REGISTRATION_INVITE_CODE is required in production (ADR-0019 family pilot)')
  }

  return {
    BETTER_AUTH_SECRET: source.BETTER_AUTH_SECRET,
    CHILD_SESSION_SECRET: childSessionSecret,
    PIPELINE_API_KEY: pipelineApiKey(source),
    REGISTRATION_INVITE_CODE: registrationInviteCode,
  }
}

/** The retention worker (worker.ts) reads only the pipeline key. */
export function loadSproutWorkerEnv(source: Environment = process.env): SproutWorkerEnv {
  assertFitForDeployment(source, { PIPELINE_API_KEY: MIN_DEPLOYED_LENGTH.PIPELINE_API_KEY })

  return { PIPELINE_API_KEY: pipelineApiKey(source) }
}
