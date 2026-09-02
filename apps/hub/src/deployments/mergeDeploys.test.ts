import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { mergeDeploys, serialiseDeployments, type Deployments } from './mergeDeploys.ts'

const at = '2026-08-25T20:44:07Z'
const earlier = '2026-08-07T15:47:59Z'

describe('mergeDeploys', () => {
  it('seeds both dates for an app it has never seen', () => {
    expect(mergeDeploys({}, ['silt'], at)).toEqual({
      silt: { firstDeployedAt: at, lastDeployedAt: at },
    })
  })

  it('moves only lastDeployedAt for an app it already knows', () => {
    const current: Deployments = {
      silt: { firstDeployedAt: earlier, lastDeployedAt: earlier },
    }
    expect(mergeDeploys(current, ['silt'], at)).toEqual({
      silt: { firstDeployedAt: earlier, lastDeployedAt: at },
    })
  })

  it('leaves apps that did not deploy untouched', () => {
    const current: Deployments = {
      boop: { firstDeployedAt: earlier, lastDeployedAt: earlier },
      silt: { firstDeployedAt: earlier, lastDeployedAt: earlier },
    }
    expect(mergeDeploys(current, ['silt'], at).boop).toEqual(current.boop)
  })

  it('records several apps from one push', () => {
    const merged = mergeDeploys({}, ['silt', 'boop'], at)
    expect(Object.keys(merged).sort()).toEqual(['boop', 'silt'])
  })

  it('is a no-op when nothing deployed', () => {
    const current: Deployments = {
      silt: { firstDeployedAt: earlier, lastDeployedAt: earlier },
    }
    expect(mergeDeploys(current, [], at)).toEqual(current)
  })
})

describe('serialiseDeployments', () => {
  it('sorts keys so the CI diff is one line per app, never a reordering', () => {
    const out = serialiseDeployments({
      silt: { firstDeployedAt: at, lastDeployedAt: at },
      boop: { firstDeployedAt: at, lastDeployedAt: at },
    })
    expect(out.indexOf('"boop"')).toBeLessThan(out.indexOf('"silt"'))
  })

  it('ends with a newline', () => {
    expect(serialiseDeployments({})).toMatch(/\n$/)
  })

  it('is stable — the same input twice is byte-identical', () => {
    const once = serialiseDeployments(mergeDeploys({}, ['silt'], at))
    const twice = serialiseDeployments(mergeDeploys(JSON.parse(once) as Deployments, ['silt'], at))
    expect(twice).toBe(once)
  })
})

describe('the committed deployments.json', () => {
  it('is already in the shape the recorder writes, so the first CI commit is a one-line diff', () => {
    const file = fileURLToPath(new URL('../generated/deployments.json', import.meta.url))
    const onDisk = readFileSync(file, 'utf8')
    expect(serialiseDeployments(JSON.parse(onDisk) as Deployments)).toBe(onDisk)
  })
})
