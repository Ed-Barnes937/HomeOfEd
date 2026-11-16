import { defaults, type Params } from '../engine/schema.ts'
import { type IngredientId } from './ingredients.ts'
import { potionSchema } from './potionSchema.ts'
import { withPours } from './pours.ts'

const recipe = (
  pours: [IngredientId, IngredientId, IngredientId],
  mixed: 'no' | 'yes',
  values: Params,
): Params => ({
  ...defaults(potionSchema),
  ...withPours(pours),
  mixed,
  ...values,
})

export const potionPresets: { name: string; params: Params }[] = [
  {
    name: 'Rosy Moonrise',
    params: recipe(['moonmilk', 'rosehip', 'starpetal'], 'no', {
      shape: 'teardrop',
      neck: 0.4,
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
    }),
  },
  {
    name: 'Early Riser',
    params: recipe(['bluebell', 'starpetal', 'emberroot'], 'yes', {
      shape: 'round',
      neck: 0.3,
      glass: 'sea',
      stopper: 'glass',
      label: 'banner',
    }),
  },
  {
    name: 'Puddle Jumper',
    params: recipe(['frogfizz', 'bluebell', 'puffcap'], 'yes', {
      shape: 'tall',
      neck: 0.6,
      glass: 'sea',
      stopper: 'cork',
      label: 'tag',
    }),
  },
  {
    name: 'Brewing Weather',
    params: recipe(['thundercloud', 'snailshine', 'moonmilk'], 'yes', {
      shape: 'shoulder',
      neck: 0.5,
      glass: 'violet',
      stopper: 'cork',
      label: 'none',
    }),
  },
  {
    name: 'Hearth Warmer',
    params: recipe(['emberroot', 'emberroot', 'puffcap'], 'yes', {
      shape: 'gourd',
      neck: 0.7,
      glass: 'amber',
      stopper: 'cork',
      label: 'round',
    }),
  },
  {
    name: 'Pebble Beach',
    params: recipe(['snailshine', 'bluebell', 'bluebell'], 'yes', {
      shape: 'teardrop',
      neck: 0.8,
      glass: 'sea',
      stopper: 'glass',
      label: 'tag',
    }),
  },
  {
    name: 'Night Sky',
    params: recipe(['moonmilk', 'moonmilk', 'rosehip'], 'yes', {
      shape: 'round',
      neck: 0.1,
      glass: 'violet',
      stopper: 'glass',
      label: 'banner',
    }),
  },
  {
    name: 'Lily Pad',
    params: recipe(['frogfizz', 'frogfizz', 'snailshine'], 'yes', {
      shape: 'tall',
      neck: 0.9,
      glass: 'clear',
      stopper: 'glass',
      label: 'round',
    }),
  },
]
