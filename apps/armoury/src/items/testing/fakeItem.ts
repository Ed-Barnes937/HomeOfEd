import { normalise, type ItemSchema } from '../../engine/schema.ts'
import type { ItemDef } from '../item.ts'
import { shopNumber } from '../shopNumber.ts'

const schema: ItemSchema = {
  itemType: 'sword',
  groups: [
    { key: 'kind', label: 'Kind of sword' },
    { key: 'blade', label: 'Blade' },
    { key: 'hilt', label: 'Hilt' },
  ],
  params: [
    {
      kind: 'choice',
      key: 'family',
      label: 'Kind of sword',
      group: 'kind',
      default: 'dagger',
      options: [
        { value: 'dagger', label: 'Dagger' },
        { value: 'longsword', label: 'Longsword' },
      ],
    },
    {
      kind: 'number',
      key: 'length',
      label: 'Length',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.5,
    },
    {
      kind: 'choice',
      key: 'fuller',
      label: 'Fuller',
      group: 'blade',
      default: 'none',
      options: [
        { value: 'none', label: 'None' },
        { value: 'one', label: 'One' },
      ],
    },
    {
      kind: 'choice',
      key: 'guard',
      label: 'Guard',
      group: 'hilt',
      default: 'cross',
      options: [
        { value: 'cross', label: 'Cross' },
        { value: 'disc', label: 'Disc' },
        { value: 'ring', label: 'Ring' },
      ],
    },
  ],
}

/** A second item kind for tests: small, and nothing like a wand. */
export const fakeSword: ItemDef = {
  kind: 'sword',
  schema,
  storageKey: 'armoury:save:sword',
  firstVisit: () => normalise(schema, {}),
  keeps: ['kind'],
  follows: (before, key, value) =>
    key === 'family' && value === 'longsword' && before.family !== 'longsword'
      ? { fuller: 'one' }
      : undefined,
  name: (p) => `The ${p.family}`,
  number: shopNumber,
  tagLine: (p) => `A ${p.family} with a ${p.guard} guard.`,
  lore: () => 'Forged for a test.',
  shelfLine: (p) => `${p.family}, ${p.guard} guard`,
  glow: () => '#ff8a3c',
  lengthFraction: (p) => 0.55 + 0.45 * (p.length as number),
}
