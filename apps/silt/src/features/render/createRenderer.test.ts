import { describe, expect, it } from 'vitest'

import { selectRenderer } from './createRenderer.ts'

describe('selectRenderer', () => {
  it('picks webgl2 (and hands back the context) when the canvas provides one', () => {
    const gl = {}
    const selected = selectRenderer({ getContext: () => gl })
    expect(selected).toEqual({ kind: 'webgl2', gl })
  })

  it('falls back to 2d when webgl2 is unavailable', () => {
    expect(selectRenderer({ getContext: () => null })).toEqual({ kind: '2d' })
  })

  it('falls back to 2d when asking for webgl2 throws', () => {
    const selected = selectRenderer({
      getContext: () => {
        throw new Error('no GPU for you')
      },
    })
    expect(selected).toEqual({ kind: '2d' })
  })
})
