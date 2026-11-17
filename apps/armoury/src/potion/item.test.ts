import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { createWorkbench, startWorkbench } from '../workbench/workbench.ts'
import { potionName, potionNumber } from './describe.ts'
import { potionItem } from './item.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { pourList } from './pours.ts'

const workbench = createWorkbench(potionItem)

describe('the potion item', () => {
  it('is the potion kind with its schema and its own save key', () => {
    expect(potionItem.kind).toBe('potion')
    expect(potionItem.schema).toBe(potionSchema)
    expect(potionItem.storageKey).toBe('armoury:save:potion')
  })

  it('starts a first visit with preset 0, normalised', () => {
    expect(potionItem.firstVisit()).toEqual(normalise(potionSchema, potionPresets[0]!.params))
    expect(pourList(potionItem.firstVisit())).toEqual(['moonmilk', 'rosehip', 'starpetal'])
  })

  it('keeps nothing on Try another but locked groups', () => {
    expect(potionItem.keeps).toEqual([])
    const start = { params: potionItem.firstVisit() }
    const locked = workbench(startWorkbench(start), { type: 'toggleLock', group: 'bottle' })
    let movedPours = false
    for (let seed = 1; seed <= 20; seed++) {
      const next = workbench(locked, { type: 'tryAnother', seed })
      movedPours ||= pourList(next.item.params).join() !== pourList(start.params).join()
      expect(next.item.params.shape).toBe(start.params.shape)
      expect(next.item.params.neck).toBe(start.params.neck)
      expect(next.item.params.glass).toBe(start.params.glass)
    }
    expect(movedPours).toBe(true)
  })

  it('pours into the lowest empty slot when an ingredient is set above a gap', () => {
    const start = startWorkbench({
      params: normalise(potionSchema, { pour1: 'moonmilk', pour2: 'none' }),
    })
    const next = workbench(start, { type: 'set', key: 'pour3', value: 'bluebell' })
    expect(pourList(next.item.params)).toEqual(['moonmilk', 'bluebell'])
  })

  it('always tries another full and unmixed', () => {
    const start = startWorkbench({
      params: normalise(potionSchema, { mixed: 'yes' }),
    })
    for (let seed = 1; seed <= 20; seed++) {
      const next = workbench(start, { type: 'tryAnother', seed })
      expect(pourList(next.item.params)).toHaveLength(3)
      expect(next.item.params.mixed).toBe('no')
    }
  })

  it('describes a potion through the item', () => {
    const p = potionItem.firstVisit()
    expect(potionItem.name(p)).toBe(potionName(p))
    expect(potionItem.number(p)).toBe(potionNumber(p))
    expect(potionItem.tagLine(p).length).toBeGreaterThan(0)
    expect(potionItem.lore(p).length).toBeGreaterThan(0)
    expect(potionItem.shelfLine(p).length).toBeGreaterThan(0)
    expect(potionItem.glow(p)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('draws every preset at a fraction of the stage in (0, 1]', () => {
    for (const preset of potionPresets) {
      const f = potionItem.lengthFraction(normalise(potionSchema, preset.params))
      expect(f).toBeGreaterThan(0)
      expect(f).toBeLessThanOrEqual(1)
    }
  })
})
