import { describe, expect, it } from 'vitest'

import { KeyedColourCache } from './spriteCache.ts'

describe('KeyedColourCache', () => {
  it('builds one entry per colour on first use', () => {
    const cache = new KeyedColourCache<string>()
    const built: string[] = []
    const entries = cache.get('neon|triangle|2', ['#00e6ff', '#ff2bd6'], (c) => {
      built.push(c)
      return c.toUpperCase()
    })
    expect(built).toEqual(['#00e6ff', '#ff2bd6'])
    expect(entries).toEqual(['#00E6FF', '#FF2BD6'])
  })

  it('reuses cached entries while the key is unchanged', () => {
    const cache = new KeyedColourCache<string>()
    let builds = 0
    const build = (c: string) => {
      builds++
      return c
    }
    const first = cache.get('neon|triangle|2', ['#00e6ff'], build)
    const second = cache.get('neon|triangle|2', ['#00e6ff'], build)
    expect(builds).toBe(1)
    expect(second).toBe(first)
  })

  it('rebuilds when the key changes (theme, shape, or dpr)', () => {
    const cache = new KeyedColourCache<string>()
    let builds = 0
    const build = (c: string) => {
      builds++
      return c
    }
    cache.get('neon|triangle|2', ['#00e6ff'], build)
    cache.get('neon|dot|2', ['#00e6ff'], build)
    cache.get('retro|dot|2', ['#ff5d8f'], build)
    expect(builds).toBe(3)
  })
})
