import { describe, expect, it } from 'vitest'

import { rakePresets, type RakePreset } from './rake.ts'
import type { RakeId } from './state.ts'

describe('rakePresets', () => {
  const presets = rakePresets()

  it('has the exact tine counts per head', () => {
    expect(presets.marble.tines).toBe(1)
    expect(presets.wide.tines).toBe(4)
    expect(presets.deep.tines).toBe(3)
    expect(presets.fine.tines).toBe(7)
  })

  it('gives every preset all five numeric fields', () => {
    const fields: (keyof RakePreset)[] = ['tines', 'spacing', 'lw', 'spread', 'light']
    const ids: RakeId[] = ['marble', 'wide', 'deep', 'fine']
    for (const id of ids) {
      for (const field of fields) {
        expect(typeof presets[id][field]).toBe('number')
        expect(Number.isFinite(presets[id][field])).toBe(true)
      }
    }
  })
})
