import { normalise } from '../engine/schema.ts'
import type { ItemDef } from '../items/item.ts'
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

// Ticket 07 registers the kind and types this ItemDef.
export const potionItem: Omit<ItemDef, 'kind'> & { kind: 'potion' } = {
  kind: 'potion',
  schema: potionSchema,
  storageKey: 'armoury:save:potion',
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
