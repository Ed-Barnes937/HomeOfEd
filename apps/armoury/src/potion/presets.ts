import { defaults, type Params } from '../engine/schema.ts'
import { potionSchema } from './potionSchema.ts'
import { type IngredientId } from './ingredients.ts'
import { withPours } from './pours.ts'

const recipe = (pours: IngredientId[], values: Params): Params => ({
  ...defaults(potionSchema),
  ...withPours(pours),
  ...values,
})

export const potionPresets: { name: string; params: Params }[] = [
  {
    name: 'Rosy Moonrise',
    params: recipe(['moonmilk', 'rosehip', 'starpetal'], {
      shape: 'teardrop',
      neck: 0.4,
      glass: 'clear',
      stopper: 'cork',
      label: 'round',
    }),
  },
  {
    name: 'Early Riser',
    params: recipe(['bluebell', 'frogfizz', 'starpetal', 'emberroot'], {
      shape: 'round',
      neck: 0.3,
      glass: 'sea',
      stopper: 'glass',
      label: 'banner',
    }),
  },
  {
    name: 'Puddle Jumper',
    params: recipe(['bogmurk', 'frogfizz', 'snailshine'], {
      shape: 'tall',
      neck: 0.6,
      glass: 'smoky',
      stopper: 'wax',
      label: 'tag',
    }),
  },
  {
    name: 'Brewing Weather',
    params: recipe(['thundercloud', 'snailshine', 'moonmilk'], {
      shape: 'shoulder',
      neck: 0.5,
      glass: 'violet',
      stopper: 'cork',
      label: 'none',
    }),
  },
  {
    name: 'Hearth Warmer',
    params: recipe(['emberroot', 'emberroot', 'starpetal'], {
      shape: 'gourd',
      neck: 0.7,
      glass: 'amber',
      stopper: 'cork',
      label: 'round',
    }),
  },
  {
    name: 'Pebble Beach',
    params: recipe(['snailshine', 'bluebell', 'snailshine', 'bluebell'], {
      shape: 'teardrop',
      neck: 0.8,
      glass: 'sea',
      stopper: 'glass',
      label: 'tag',
    }),
  },
  {
    name: 'Night Sky',
    params: recipe(['starpetal', 'starpetal', 'starpetal', 'starpetal'], {
      shape: 'round',
      neck: 0.1,
      glass: 'violet',
      stopper: 'wax',
      label: 'banner',
    }),
  },
  {
    name: 'Pink Hum',
    params: recipe(['rosehip', 'rosehip'], {
      shape: 'tall',
      neck: 0.9,
      glass: 'clear',
      stopper: 'glass',
      label: 'round',
    }),
  },
]
