import type { ChoiceOption, ItemSchema, Params } from '../engine/schema.ts'
import { BOTTLES, type ShapeId } from './bottles.ts'
import { ingredient, INGREDIENTS, type IngredientId, isIngredient } from './ingredients.ts'

export type GlassId = 'clear' | 'sea' | 'amber' | 'violet' | 'smoky'
export type StopperId = 'cork' | 'glass'
export type LabelId = 'none' | 'round' | 'banner' | 'tag'

export const POUR_KEYS = ['pour1', 'pour2', 'pour3'] as const
export type PourKey = (typeof POUR_KEYS)[number]
export const MAX_POURS = POUR_KEYS.length
export const isMixed = (p: Params) => p.mixed === 'yes'
export const isPourKey = (key: string): key is PourKey =>
  (POUR_KEYS as readonly string[]).includes(key)

/** The one table of glass tints: the picker's swatch and the drawn glass both read it. */
export const GLASS_TINTS: Record<GlassId, string> = {
  clear: '#d8ecf2',
  sea: '#4aa88f',
  amber: '#c8841e',
  violet: '#7a4fc0',
  smoky: '#4a4650',
}

/** The picker's swatch: an ingredient's colour for a pour, a glass tint for the glass. */
export function potionSwatchFor(key: string, value: string): string | undefined {
  if (isPourKey(key)) return isIngredient(value) ? ingredient(value).colour : undefined
  if (key === 'glass') return GLASS_TINTS[value as GlassId]
  return undefined
}

const pourOptions: ChoiceOption[] = [
  { value: 'none', label: 'Empty', weight: 0 },
  ...INGREDIENTS.map((i) => ({ value: i.id, label: i.label })),
]

// No gaps: a slot is open only while the one below it holds an ingredient.
const pourAllowed = (below: PourKey) => (p: Params) =>
  p[below] === 'none' ? ['none'] : ['none', ...INGREDIENTS.map((i) => i.id)]

export const potionSchema: ItemSchema = {
  itemType: 'potion',
  groups: [
    { key: 'pours', label: 'What goes in' },
    { key: 'bottle', label: 'The bottle' },
    { key: 'finish', label: 'Stopper and label' },
  ],
  params: [
    {
      kind: 'choice',
      key: 'pour1',
      label: 'First ingredient',
      group: 'pours',
      default: 'moonmilk' satisfies IngredientId,
      options: pourOptions,
    },
    {
      kind: 'choice',
      key: 'pour2',
      label: 'Second ingredient',
      group: 'pours',
      default: 'rosehip' satisfies IngredientId,
      options: pourOptions,
      allowed: pourAllowed('pour1'),
    },
    {
      kind: 'choice',
      key: 'pour3',
      label: 'Third ingredient',
      group: 'pours',
      default: 'starpetal' satisfies IngredientId,
      options: pourOptions,
      allowed: pourAllowed('pour2'),
    },
    {
      kind: 'choice',
      key: 'mixed',
      label: 'Mixed',
      group: 'pours',
      default: 'no',
      options: [
        { value: 'no', label: 'Not mixed' },
        { value: 'yes', label: 'Mixed', weight: 0 },
      ],
      allowed: (p) => (p.pour3 === 'none' ? ['no'] : ['no', 'yes']),
    },

    {
      kind: 'choice',
      key: 'shape',
      label: 'Shape',
      group: 'bottle',
      default: 'teardrop' satisfies ShapeId,
      options: (Object.keys(BOTTLES) as ShapeId[]).map((value) => ({
        value,
        label: BOTTLES[value].label,
      })),
    },
    {
      kind: 'number',
      key: 'neck',
      label: 'Neck',
      group: 'bottle',
      min: 0,
      max: 1,
      step: 0.05,
      default: 0.4,
      ends: ['Short', 'Long'],
    },
    {
      kind: 'choice',
      key: 'glass',
      label: 'Glass',
      group: 'bottle',
      default: 'clear' satisfies GlassId,
      options: [
        { value: 'clear', label: 'Clear', weight: 4 },
        { value: 'sea', label: 'Sea green', weight: 2 },
        { value: 'amber', label: 'Amber' },
        { value: 'violet', label: 'Violet' },
        { value: 'smoky', label: 'Smoky' },
      ],
    },

    {
      kind: 'choice',
      key: 'stopper',
      label: 'Stopper',
      group: 'finish',
      default: 'cork' satisfies StopperId,
      options: [
        { value: 'cork', label: 'Cork', weight: 5 },
        { value: 'glass', label: 'Glass stopper', weight: 2 },
      ],
    },
    {
      kind: 'choice',
      key: 'label',
      label: 'Label',
      group: 'finish',
      default: 'round' satisfies LabelId,
      options: [
        { value: 'none', label: 'No label' },
        { value: 'round', label: 'Round' },
        { value: 'banner', label: 'Banner' },
        { value: 'tag', label: 'Tag on a string' },
      ],
    },
  ],
}
