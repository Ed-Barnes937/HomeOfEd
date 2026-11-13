import { normalise } from '../engine/schema.ts'
import type { ItemDef } from '../items/item.ts'
import { POTION_SAVE_KEY } from '../persistence/storage.ts'
import {
  potionGlowColour,
  potionLore,
  potionName,
  potionNumber,
  potionShelfLine,
  potionTagLine,
} from './describe.ts'
import { drawnHeightFraction } from './framing.ts'
import { potionPresets } from './presets.ts'
import { potionSchema } from './potionSchema.ts'
import { followPours } from './pours.ts'

export const potionItem: ItemDef = {
  kind: 'potion',
  schema: potionSchema,
  storageKey: POTION_SAVE_KEY,
  firstVisit: () => normalise(potionSchema, potionPresets[0]!.params),
  keeps: [],
  follows: followPours,
  name: potionName,
  number: potionNumber,
  tagLine: potionTagLine,
  lore: potionLore,
  shelfLine: potionShelfLine,
  glow: potionGlowColour,
  lengthFraction: drawnHeightFraction,
}
