import { createPublicKey } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ESTATE_APPS, HUB_LOCAL_PORTS } from './estateApps.ts'
import { familyVerifyingKey } from './familyVerifyingKey.ts'

const compose = readFileSync(
  fileURLToPath(new URL('../../../compose.yml', import.meta.url)),
  'utf8',
)

/** One top-level compose service's block, or '' when compose has no such service. */
function serviceBlock(service: string): string {
  const start = compose.indexOf(`\n  ${service}:\n`)
  if (start === -1) return ''
  const block = compose.slice(start + 1)
  const end = block.slice(1).search(/\n {2}[a-z]/)
  return end === -1 ? block : block.slice(0, end + 1)
}

/** The host ports one top-level compose service publishes onto the container's 8080. */
function publishedPorts(service: string): number[] {
  return [...serviceBlock(service).matchAll(/- '(\d+):8080'/g)].map(([, port]) => Number(port))
}

/** A single-quoted one-line PEM, with its escaped newlines restored. */
function pemValue(service: string, name: string): string | undefined {
  const match = serviceBlock(service).match(new RegExp(`^ +${name}: '(.*)'$`, 'm'))
  return match?.[1]?.replace(/\\n/g, '\n')
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

// A compose app verifying with any other key would bounce every visitor back to hub.
describe("the registry's compose verifying keys", () => {
  // A private PEM yields its public half here, so both sides compare as SPKI.
  const spki = (pem: string) => createPublicKey(pem).export({ type: 'spki', format: 'der' })
  const familySigningKey = pemValue('family', 'FAMILY_TOKEN_PRIVATE_KEY')

  it.each(ESTATE_APPS.map((app) => app.appId))(
    'give %s the public half of the key family signs with, which Fly refuses',
    (appId) => {
      const pem = pemValue(appId, 'FAMILY_TOKEN_PUBLIC_KEY')

      expect(pem).toBeDefined()
      expect(familySigningKey).toBeDefined()
      expect(spki(pem!)).toEqual(spki(familySigningKey!))
      expect(familyVerifyingKey({ FAMILY_TOKEN_PUBLIC_KEY: pem }, null)).toBe(pem)
      expect(() =>
        familyVerifyingKey({ FLY_APP_NAME: 'hoe-boop', FAMILY_TOKEN_PUBLIC_KEY: pem }, null),
      ).toThrow(/committed @hoe\/accounts\/testing key/)
    },
  )
})
