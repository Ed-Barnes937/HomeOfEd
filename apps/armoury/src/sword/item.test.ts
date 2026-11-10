import { describe, expect, it } from 'vitest'

import { normalise } from '../engine/schema.ts'
import { ITEMS } from '../items/registry.ts'
import { SAVE_KEY, SWORD_SAVE_KEY, writeWorking } from '../persistence/storage.ts'
import { FakeStorage } from '../persistence/testing/fakeStorage.ts'
import { decodeShareHash, encodeShare, SHARE_HASH_PREFIX } from '../share/shareLink.ts'
import { createWorkbench, startWorkbench } from '../workbench/workbench.ts'
import { swordLore, swordName, swordNumber, swordShelfLine, swordTagLine } from './describe.ts'
import { type Family, FAMILIES, overallLengthMm, signatureFor } from './families.ts'
import { drawnFraction } from './framing.ts'
import { swordItem } from './item.ts'
import { swordPresets } from './presets.ts'
import { swordSchema } from './swordSchema.ts'

const sword = (overrides: Record<string, unknown>) => normalise(swordSchema, overrides)

describe('the sword item', () => {
  it('is the sword kind, saved under its own key', () => {
    expect(swordItem.kind).toBe('sword')
    expect(swordItem.schema).toBe(swordSchema)
    expect(swordItem.storageKey).toBe('armoury:save:sword')
    expect(swordItem.storageKey).toBe(SWORD_SAVE_KEY)
  })

  it('starts a first visit with Hearthside', () => {
    expect(swordItem.firstVisit()).toEqual(sword(swordPresets[0]!.params))
  })

  it('brings the new Kind its signature when the Kind changes, and nothing else follows', () => {
    const knight = swordItem.firstVisit()
    for (const family of Object.keys(FAMILIES) as Family[]) {
      if (family === 'knight') continue
      expect(swordItem.follows?.(knight, 'family', family)).toEqual(signatureFor(family))
    }
    expect(swordItem.follows?.(knight, 'family', 'knight')).toBeUndefined()
    expect(swordItem.follows?.(knight, 'steel', 'dark')).toBeUndefined()
    expect(swordItem.follows?.(knight, 'guard', 'curved')).toBeUndefined()
  })

  it("lands on the Kind's signature when the Kind changes on the bench", () => {
    const bench = createWorkbench(swordItem)
    const start = startWorkbench({
      params: sword({
        ...swordItem.firstVisit(),
        profile: 'leaf',
        pommel: 'lobed',
        steel: 'bright',
      }),
    })
    const next = bench(start, { type: 'set', key: 'family', value: 'katana' })
    expect(next.item.params).toMatchObject({ family: 'katana', ...signatureFor('katana') })
    expect(next.item.params.steel).toBe('bright')
    const back = bench(next, { type: 'set', key: 'family', value: 'sabre' })
    expect(back.item.params).toMatchObject({ family: 'sabre', ...signatureFor('sabre') })
  })

  it('keeps the Kind on Try another', () => {
    const bench = createWorkbench(swordItem)
    const rapier = { params: sword({ family: 'rapier', ...signatureFor('rapier') }) }
    for (let seed = 1; seed <= 20; seed++) {
      expect(bench(startWorkbench(rapier), { type: 'tryAnother', seed }).item.params.family).toBe(
        'rapier',
      )
    }
  })

  it('describes a sword with the derived words', () => {
    const p = swordItem.firstVisit()
    expect(swordItem.name(p)).toBe(swordName(p))
    expect(swordItem.number(p)).toBe(swordNumber(p))
    expect(swordItem.tagLine(p)).toBe(swordTagLine(p))
    expect(swordItem.lore(p)).toBe(swordLore(p))
    expect(swordItem.shelfLine(p)).toBe(swordShelfLine(p))
  })

  it('glows as a seven-character hex colour', () => {
    expect(swordItem.glow(swordItem.firstVisit())).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('is drawn at the framing fraction of its overall length', () => {
    for (const preset of swordPresets) {
      const p = sword(preset.params)
      expect(swordItem.lengthFraction(p)).toBe(drawnFraction(overallLengthMm(p)))
    }
  })
})

describe('the registered sword', () => {
  it('is in the registry', () => {
    expect(ITEMS.sword).toBe(swordItem)
  })

  it('arrives from a link that names a sword', () => {
    const item = { params: swordPresets[7]!.params }
    expect(decodeShareHash(`${SHARE_HASH_PREFIX}${encodeShare('sword', item)}`)).toEqual({
      kind: 'sword',
      item: { params: sword(item.params) },
    })
  })

  it('saves under its own key and leaves the wand save alone', () => {
    const storage = new FakeStorage()
    writeWorking(storage, swordItem, { params: swordItem.firstVisit() })
    expect([...storage.store.keys()]).toEqual(['armoury:save:sword'])
    expect(storage.getItem(SAVE_KEY)).toBeNull()
  })
})
