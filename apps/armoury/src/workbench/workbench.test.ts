import { describe, expect, it } from 'vitest'

import { defaults, normalise } from '../engine/schema.ts'
import { fakeSword } from '../items/testing/fakeItem.ts'
import { wandItem } from '../wand/item.ts'
import { wandSchema } from '../wand/wandSchema.ts'
import { createWorkbench, startWorkbench } from './workbench.ts'

const workbench = createWorkbench(wandItem)

const oak = { params: normalise(wandSchema, { wood: 'oak', core: 'starlight' }) }

describe('workbench', () => {
  it('changes one part and keeps the result valid', () => {
    let state = startWorkbench(oak)
    state = workbench(state, { type: 'set', key: 'wood', value: 'walnut' })
    expect(state.item.params.wood).toBe('walnut')
    state = workbench(state, { type: 'set', key: 'stainColour', value: 'plum' })
    expect(state.item.params.stainColour).not.toBe('plum')
  })

  it('tries another wand, and puts the last one back', () => {
    let state = startWorkbench(oak)
    state = workbench(state, { type: 'tryAnother', seed: 3 })
    expect(state.item.params).not.toEqual(oak.params)
    expect(state.arrivals).toBe(1)
    state = workbench(state, { type: 'putBack' })
    expect(state.item).toEqual(oak)
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
      expect(next.item.params.core).toBe('starlight')
      expect(next.item.params.wood).toBe('oak')
    }
    state = workbench(state, { type: 'toggleLock', group: 'core' })
    expect(state.locked).toEqual(['finish'])
  })

  it('keeps the kind of wand when trying another, unlocked', () => {
    for (const kind of ['turned', 'branch']) {
      const state = startWorkbench({ params: normalise(wandSchema, { kind }) })
      expect(workbench(state, { type: 'tryAnother', seed: 1 }).item.params.kind).toBe(kind)
    }
  })

  it('a wand made a Branch starts with patches of bark; a saved Branch keeps its bark', () => {
    let state = startWorkbench({ params: normalise(wandSchema, {}) })
    state = workbench(state, { type: 'set', key: 'kind', value: 'branch' })
    expect(state.item.params.bark).toBe('patches')
    state = workbench(state, { type: 'set', key: 'bark', value: 'full' })
    state = workbench(state, { type: 'set', key: 'wood', value: 'maple' })
    expect(state.item.params.bark).toBe('full')
    const saved = startWorkbench({ params: normalise(wandSchema, { kind: 'branch' }) })
    expect(saved.item.params.bark).toBe('none')
  })

  it('a new wand loses the old one’s name, a renamed one keeps it', () => {
    let state = startWorkbench({ ...oak, name: 'Acorn' })
    state = workbench(state, { type: 'set', key: 'lengthCm', value: 30 })
    expect(state.item.name).toBe('Acorn')
    state = workbench(state, { type: 'tryAnother', seed: 1 })
    expect(state.item.name).toBeUndefined()
    state = workbench(state, { type: 'rename', name: '  Bramble ' })
    expect(state.item.name).toBe('Bramble')
    state = workbench(state, { type: 'rename', name: ' ' })
    expect(state.item.name).toBeUndefined()
  })

  it('loads a wand from the shelf or a link', () => {
    const state = workbench(startWorkbench(oak), {
      type: 'load',
      item: { params: defaults(wandSchema), name: 'Shared' },
    })
    expect(state.item).toEqual({ params: defaults(wandSchema), name: 'Shared' })
    expect(state.arrivals).toBe(1)
  })
})

describe('a workbench for another kind of item', () => {
  const smithy = createWorkbench(fakeSword)
  const dagger = { params: fakeSword.firstVisit() }

  it('changes one part and keeps the result valid by its own schema', () => {
    let state = smithy(startWorkbench(dagger), { type: 'set', key: 'guard', value: 'ring' })
    expect(state.item.params.guard).toBe('ring')
    state = smithy(state, { type: 'set', key: 'guard', value: 'basket' })
    expect(state.item.params.guard).toBe('cross')
    state = smithy(state, { type: 'set', key: 'length', value: 7 })
    expect(state.item.params).toEqual({ ...dagger.params, length: 1 })
  })

  it('brings along what the item says follows a change, and only then', () => {
    let state = smithy(startWorkbench(dagger), { type: 'set', key: 'family', value: 'longsword' })
    expect(state.item.params.fuller).toBe('one')
    state = smithy(state, { type: 'set', key: 'fuller', value: 'none' })
    state = smithy(state, { type: 'set', key: 'family', value: 'longsword' })
    expect(state.item.params.fuller).toBe('none')
  })

  it('has no wand rules: nothing follows a change the item does not name', () => {
    const state = smithy(startWorkbench(dagger), { type: 'set', key: 'guard', value: 'disc' })
    expect(state.item.params).toEqual({ ...dagger.params, guard: 'disc' })
  })

  it('keeps the groups the item keeps when trying another, and rolls the rest', () => {
    const longsword = { params: { ...dagger.params, family: 'longsword' } }
    const guards = new Set<unknown>()
    for (let seed = 1; seed <= 20; seed++) {
      const next = smithy(startWorkbench(longsword), { type: 'tryAnother', seed })
      expect(next.item.params.family).toBe('longsword')
      expect(next.previous).toEqual(longsword)
      guards.add(next.item.params.guard)
    }
    expect(guards.size).toBeGreaterThan(1)
  })

  it('keeps a locked group as well as the item’s own', () => {
    const start = { params: { ...dagger.params, guard: 'disc' } }
    const state = smithy(startWorkbench(start), { type: 'toggleLock', group: 'hilt' })
    for (let seed = 1; seed <= 20; seed++) {
      const next = smithy(state, { type: 'tryAnother', seed })
      expect(next.item.params.guard).toBe('disc')
      expect(next.item.params.family).toBe('dagger')
    }
  })

  it('rolls everything for an item that keeps nothing', () => {
    const loose = createWorkbench({ ...fakeSword, keeps: [] })
    const families = new Set<unknown>()
    for (let seed = 1; seed <= 20; seed++) {
      families.add(loose(startWorkbench(dagger), { type: 'tryAnother', seed }).item.params.family)
    }
    expect(families.size).toBe(2)
  })
})
