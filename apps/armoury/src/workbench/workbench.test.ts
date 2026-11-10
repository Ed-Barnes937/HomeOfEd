import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import { startWorkbench, workbench } from './workbench.ts'

const oak = { params: normalise(wandSchema, { wood: 'oak', core: 'starlight' }) }

describe('workbench', () => {
  it('changes one part and keeps the result valid', () => {
    let state = startWorkbench(oak)
    state = workbench(state, { type: 'set', key: 'wood', value: 'walnut' })
    expect(state.wand.params.wood).toBe('walnut')
    state = workbench(state, { type: 'set', key: 'stainColour', value: 'plum' })
    expect(state.wand.params.stainColour).not.toBe('plum')
  })

  it('tries another wand, and puts the last one back', () => {
    let state = startWorkbench(oak)
    state = workbench(state, { type: 'tryAnother', seed: 3 })
    expect(state.wand.params).not.toEqual(oak.params)
    expect(state.arrivals).toBe(1)
    state = workbench(state, { type: 'putBack' })
    expect(state.wand).toEqual(oak)
    expect(state.previous).toBeNull()
  })

  it('forgets the wand to put back once you change the new one', () => {
    let state = workbench(startWorkbench(oak), { type: 'tryAnother', seed: 3 })
    state = workbench(state, { type: 'set', key: 'lengthCm', value: 30 })
    expect(state.previous).toBeNull()
  })

  it('keeps locked parts when trying another', () => {
    let state = workbench(startWorkbench(oak), { type: 'toggleLock', group: 'core' })
    state = workbench(state, { type: 'toggleLock', group: 'finish' })
    for (let seed = 1; seed < 10; seed++) {
      const next = workbench(state, { type: 'tryAnother', seed })
      expect(next.wand.params.core).toBe('starlight')
      expect(next.wand.params.wood).toBe('oak')
    }
    state = workbench(state, { type: 'toggleLock', group: 'core' })
    expect(state.locked).toEqual(['finish'])
  })

  it('keeps the kind of wand when trying another, unlocked', () => {
    for (const kind of ['turned', 'branch']) {
      const state = startWorkbench({ params: normalise(wandSchema, { kind }) })
      expect(workbench(state, { type: 'tryAnother', seed: 1 }).wand.params.kind).toBe(kind)
    }
  })

  it('a wand made a Branch starts with patches of bark; a saved Branch keeps its bark', () => {
    let state = startWorkbench({ params: normalise(wandSchema, {}) })
    state = workbench(state, { type: 'set', key: 'kind', value: 'branch' })
    expect(state.wand.params.bark).toBe('patches')
    state = workbench(state, { type: 'set', key: 'bark', value: 'full' })
    state = workbench(state, { type: 'set', key: 'wood', value: 'maple' })
    expect(state.wand.params.bark).toBe('full')
    const saved = startWorkbench({ params: normalise(wandSchema, { kind: 'branch' }) })
    expect(saved.wand.params.bark).toBe('none')
  })

  it('a new wand loses the old one’s name, a renamed one keeps it', () => {
    let state = startWorkbench({ ...oak, name: 'Acorn' })
    state = workbench(state, { type: 'set', key: 'lengthCm', value: 30 })
    expect(state.wand.name).toBe('Acorn')
    state = workbench(state, { type: 'tryAnother', seed: 1 })
    expect(state.wand.name).toBeUndefined()
    state = workbench(state, { type: 'rename', name: '  Bramble ' })
    expect(state.wand.name).toBe('Bramble')
    state = workbench(state, { type: 'rename', name: ' ' })
    expect(state.wand.name).toBeUndefined()
  })

  it('loads a wand from the shelf or a link', () => {
    const state = workbench(startWorkbench(oak), {
      type: 'load',
      wand: { params: defaults(wandSchema), name: 'Shared' },
    })
    expect(state.wand).toEqual({ params: defaults(wandSchema), name: 'Shared' })
    expect(state.arrivals).toBe(1)
  })
})
