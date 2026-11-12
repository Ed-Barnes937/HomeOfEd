import { normalise, type Params } from '../engine/schema.ts'
import type { ItemDef } from '../items/item.ts'
import { SWORD_SAVE_KEY } from '../persistence/storage.ts'
import {
  swordGlowColour,
  swordLore,
  swordName,
  swordNumber,
  swordShelfLine,
  swordTagLine,
} from './describe.ts'
import { type Family, overallLengthMm, signatureFor } from './families.ts'
import { drawnFraction } from './framing.ts'
import { swordPresets } from './presets.ts'
import { swordSchema } from './swordSchema.ts'

export const swordItem: ItemDef = {
  kind: 'sword',
  schema: swordSchema,
  storageKey: SWORD_SAVE_KEY,
  firstVisit: () => normalise(swordSchema, swordPresets[0]!.params),
  keeps: ['kind'],
  follows: (before, key, value) =>
    key === 'family' && value !== before.family
      ? (signatureFor(value as Family) as Params)
      : undefined,
  name: swordName,
  number: swordNumber,
  tagLine: swordTagLine,
  lore: swordLore,
  shelfLine: swordShelfLine,
  glow: swordGlowColour,
  lengthFraction: (p) => drawnFraction(overallLengthMm(p)),
}
