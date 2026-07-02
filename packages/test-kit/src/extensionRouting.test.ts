// Extension routing: Vitest owns *.test.*, Playwright CT owns *.iwft.tsx,
// the (inert) e2e runner owns *.e2e.*. These assertions pin the runner
// configs so no file can be picked up by two runners.
import { describe, expect, it } from 'vitest'

import { defineIwftConfig } from './ctConfig.ts'
import { defineE2eConfig } from './e2eConfig.ts'

describe('extension routing', () => {
  it('the CT config only matches *.iwft.tsx files', () => {
    const config = defineIwftConfig({ ctPort: 3999 })
    expect(config.testMatch).toBe('**/*.iwft.tsx')
  })

  it('the e2e config only matches *.e2e files', () => {
    const config = defineE2eConfig()
    expect(config.testMatch).toBe('**/*.e2e.{ts,tsx}')
  })

  it('neither Playwright config can claim Vitest-owned *.test.* files', () => {
    expect(defineIwftConfig({ ctPort: 3999 }).testMatch).not.toContain('test')
    expect(defineE2eConfig().testMatch).not.toContain('test')
  })
})
