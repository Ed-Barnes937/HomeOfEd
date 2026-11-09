import type { ChoiceParam, Params } from '../../engine/schema.ts'
import { coreName } from '../../wand/describe.ts'
import { wandSchema } from '../../wand/wandSchema.ts'

export interface GroupMeta {
  key: string
  numeral: string
  title: string
  /** The short phone tab label. */
  tab: string
  summary: (p: Params) => string
}

const labelOf = (key: string, p: Params) => {
  const def = wandSchema.params.find((d): d is ChoiceParam => d.key === key && d.kind === 'choice')
  return def?.options.find((o) => o.value === p[key])?.label ?? ''
}

export const GROUPS: readonly GroupMeta[] = [
  {
    key: 'finish',
    numeral: 'i.',
    title: 'The wood',
    tab: 'Wood',
    summary: (p) => labelOf('wood', p),
  },
  {
    key: 'shape',
    numeral: 'ii.',
    title: 'The shape',
    tab: 'Shape',
    summary: (p) => `${p.lengthCm as number} cm`,
  },
  {
    key: 'handle',
    numeral: 'iii.',
    title: 'The handle',
    tab: 'Handle',
    summary: (p) => labelOf('handleStyle', p),
  },
  {
    key: 'shaft',
    numeral: 'iv.',
    title: 'The shaft',
    tab: 'Shaft',
    summary: (p) => labelOf('shaftCarving', p),
  },
  {
    key: 'core',
    numeral: 'v.',
    title: 'The core',
    tab: 'Core',
    summary: (p) => coreName(p.core as string),
  },
]
