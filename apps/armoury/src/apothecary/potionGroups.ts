import { isVisible, type ChoiceParam, type Params } from '../engine/schema.ts'
import { isMixed, potionSchema } from '../potion/potionSchema.ts'
import { pourList } from '../potion/pours.ts'
import type { GroupMeta } from '../shop/shopView.ts'

const labelOf = (key: string, p: Params) => {
  const def = potionSchema.params.find(
    (d): d is ChoiceParam => d.key === key && d.kind === 'choice',
  )
  return def?.options.find((o) => o.value === p[key])?.label ?? ''
}

const NUMERALS = ['i.', 'ii.', 'iii.']

const COUNT_WORDS = ['Empty', 'One', 'Two', 'Three']

const pours = (p: Params) => (isMixed(p) ? 'Mixed' : COUNT_WORDS[pourList(p).length]!)

const GROUP_DEFS: readonly Omit<GroupMeta, 'numeral'>[] = [
  { key: 'pours', title: 'What goes in', tab: 'Pours', summary: pours, lockInTabRow: true },
  { key: 'bottle', title: 'The bottle', tab: 'Bottle', summary: (p) => labelOf('shape', p) },
  {
    key: 'finish',
    title: 'Stopper and label',
    tab: 'Finish',
    summary: (p) => labelOf('stopper', p),
  },
]

const hasControls = (group: string, p: Params) =>
  potionSchema.params.some((d) => d.group === group && isVisible(d, p))

/** The panel's groups for this potion, in order: a group shows while it has a control to show. */
export function visibleGroups(p: Params): GroupMeta[] {
  return GROUP_DEFS.filter((g) => hasControls(g.key, p)).map((g, i) => ({
    ...g,
    numeral: NUMERALS[i]!,
  }))
}
