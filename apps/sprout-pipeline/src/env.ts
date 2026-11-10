// The shared service-to-service key, checked once at boot. Never logged.
import { assertFitForDeployment, type Environment } from '@hoe/deploy-guard'

/** On Fly, nothing this repo publishes may pass (ADR 0088). */
export const resolvePipelineApiKey = (source: Environment = process.env): string => {
  assertFitForDeployment(source, { PIPELINE_API_KEY: 32 })

  const key = source.PIPELINE_API_KEY
  if (key) return key
  if (source.NODE_ENV === 'production') {
    throw new Error(
      'PIPELINE_API_KEY must be set in production. Refusing to start with an insecure default.',
    )
  }
  return 'dev-pipeline-key'
}
