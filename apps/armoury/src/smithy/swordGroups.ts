import { isVisible, type ChoiceParam, type Params } from '../engine/schema.ts'
import type { GroupMeta } from '../shop/shopView.ts'
import { overallLengthMm } from '../sword/families.ts'
import { hasGems, hasRunes, swordSchema } from '../sword/swordSchema.ts'

const labelOf = (key: string, p: Params) => {
  const def = swordSchema.params.find((d): d is ChoiceParam => d.key === key && d.kind === 'choice')
  return def?.options.find((o) => o.value === p[key])?.label ?? ''
}

const NUMERALS = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.']

const inches = (p: Params) => `${Math.round((overallLengthMm(p) / 25.4) * 2) / 2} in`

const GROUP_DEFS: readonly Omit<GroupMeta, 'numeral'>[] = [
  { key: 'metal', title: 'The metal', tab: 'Metal', summary: (p) => labelOf('steel', p) },
  { key: 'blade', title: 'The blade', tab: 'Blade', summary: inches },
  { key: 'edge', title: 'Edge and tip', tab: 'Tip', summary: (p) => labelOf('tip', p) },
  { key: 'guard', title: 'The guard', tab: 'Guard', summary: (p) => labelOf('guard', p) },
  { key: 'grip', title: 'The grip', tab: 'Grip', summary: (p) => labelOf('wrap', p) },
  { key: 'pommel', title: 'The pommel', tab: 'Pommel', summary: (p) => labelOf('pommel', p) },
  {
    key: 'extras',
    title: 'Finishing touches',
    tab: 'Extras',
    summary: (p) =>
      hasRunes(p) && hasGems(p)
        ? 'Runes and gems'
        : hasRunes(p)
          ? 'Runes'
          : hasGems(p)
            ? 'Gems'
            : 'Plain',
  },
]

const hasControls = (group: string, p: Params) =>
  swordSchema.params.some((d) => d.group === group && isVisible(d, p))

/** The panel's groups for this sword, in order: a group shows while it has a control to show. */
export function visibleGroups(p: Params): GroupMeta[] {
  return GROUP_DEFS.filter((g) => hasControls(g.key, p)).map((g, i) => ({
    ...g,
    numeral: NUMERALS[i]!,
  }))
}
