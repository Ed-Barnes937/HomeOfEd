import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ESTATE_APPS, HUB_LOCAL_PORTS } from './estateApps.ts'

const compose = readFileSync(
  fileURLToPath(new URL('../../../compose.yml', import.meta.url)),
  'utf8',
)

/** The host ports one top-level compose service publishes onto the container's 8080. */
function publishedPorts(service: string): number[] {
  const start = compose.indexOf(`\n  ${service}:\n`)
  if (start === -1) return []
  const block = compose.slice(start + 1)
  const end = block.slice(1).search(/\n {2}[a-z]/)
  const body = end === -1 ? block : block.slice(0, end + 1)
  return [...body.matchAll(/- '(\d+):8080'/g)].map(([, port]) => Number(port))
}

// Hub's returnTo allowlist and the apps' family URLs trust these ports, so a
// compose port that drifts from the registry fails here, not in a browser.
describe("the registry's compose ports", () => {
  it('match the port compose publishes hub on', () => {
    expect(publishedPorts('hub')).toEqual([HUB_LOCAL_PORTS.composePort])
  })

  it.each(ESTATE_APPS.map((app) => [app.appId, app.composePort] as const))(
    'match the port compose publishes %s on',
    (appId, composePort) => {
      expect(publishedPorts(appId)).toEqual([composePort])
    },
  )
})
