import { normalise, type NumberParam } from '../engine/schema.ts'
import type { ItemDef } from '../items/item.ts'
import { SAVE_KEY } from '../persistence/storage.ts'
import {
  coreName,
  inchesInWords,
  madeOf,
  wandDescription,
  wandLore,
  wandName,
  wandNumber,
} from './describe.ts'
import { wandPresets } from './presets.ts'
import { swatchFor, wandSchema } from './wandSchema.ts'

const lengthCm = wandSchema.params.find((def) => def.key === 'lengthCm') as NumberParam

export const wandItem: ItemDef = {
  kind: 'wand',
  schema: wandSchema,
  storageKey: SAVE_KEY,
  firstVisit: () => normalise(wandSchema, wandPresets[0]!.params),
  keeps: ['kind'],
  // A wand just made a Branch starts with some bark; a saved one keeps what it had.
  follows: (before, key, value) =>
    key === 'kind' && value === 'branch' && before.kind !== 'branch'
      ? { bark: 'patches' }
      : undefined,
  name: wandName,
  number: wandNumber,
  tagLine: wandDescription,
  lore: wandLore,
  shelfLine: (p) =>
    `${inchesInWords(p.lengthCm as number)}, ${madeOf(p)}, ${coreName(p.core as string).toLowerCase()}`,
  glow: (p) => swatchFor('core', p.core as string) ?? '#ffc95c',
  lengthFraction: (p) => (p.lengthCm as number) / lengthCm.max,
}
