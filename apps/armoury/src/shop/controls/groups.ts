import type { ChoiceParam, Params } from '../../engine/schema.ts'
import { coreName } from '../../wand/describe.ts'
import {
  hasGems,
  hasStencil,
  hasTurnedHandle,
  isBranch,
  usesMetal,
  usesPaint,
  wandSchema,
} from '../../wand/wandSchema.ts'

export interface GroupMeta {
  key: string
  /** Counted over the groups shown, so there's never a gap. */
  numeral: string
  title: string
  /** The short phone tab label. */
  tab: string
  summary: (p: Params) => string
}

interface GroupDef extends Omit<GroupMeta, 'numeral'> {
  shows?: (p: Params) => boolean
}

const labelOf = (key: string, p: Params) => {
  const def = wandSchema.params.find((d): d is ChoiceParam => d.key === key && d.kind === 'choice')
  return def?.options.find((o) => o.value === p[key])?.label ?? ''
}

const NUMERALS = ['i.', 'ii.', 'iii.', 'iv.', 'v.', 'vi.', 'vii.', 'viii.']

const GROUP_DEFS: readonly GroupDef[] = [
  {
    key: 'finish',
    title: 'The wood',
    tab: 'Wood',
    summary: (p) => labelOf('wood', p),
  },
  {
    key: 'shape',
    title: 'The shape',
    tab: 'Shape',
    summary: (p) => `${p.lengthCm as number} cm`,
  },
  {
    key: 'branch',
    title: 'The branch',
    tab: 'Branch',
    shows: isBranch,
    summary: (p) => {
      const knots = p.knots as number
      return knots === 0 ? 'No knots' : knots === 1 ? '1 knot' : `${knots} knots`
    },
  },
  {
    key: 'handle',
    title: 'The handle',
    tab: 'Handle',
    summary: (p) => (hasTurnedHandle(p) ? labelOf('handleStyle', p) : labelOf('branchHandle', p)),
  },
  {
    key: 'shaft',
    title: 'The shaft',
    tab: 'Shaft',
    summary: (p) =>
      isBranch(p)
        ? p.nodes === 'none'
          ? 'Smooth'
          : labelOf('nodes', p)
        : p.shaftCarving === 'none' && p.nodes !== 'none'
          ? labelOf('nodes', p)
          : labelOf('shaftCarving', p),
  },
  {
    key: 'decor',
    title: 'The trimmings',
    tab: 'Trim',
    summary: (p) =>
      usesMetal(p)
        ? labelOf('metal', p)
        : usesPaint(p)
          ? labelOf('paintColour', p)
          : p.handleFinish === 'bone' || p.shaftFinish === 'bone'
            ? 'Bone'
            : hasGems(p)
              ? 'Gems'
              : hasStencil(p)
                ? labelOf('stencil', p)
                : 'None',
  },
  {
    key: 'core',
    title: 'The core',
    tab: 'Core',
    summary: (p) => coreName(p.core as string),
  },
]

/** The panel's groups for this wand, in order. */
export function visibleGroups(p: Params): GroupMeta[] {
  return GROUP_DEFS.filter((g) => g.shows?.(p) ?? true).map((g, i) => ({
    key: g.key,
    numeral: NUMERALS[i]!,
    title: g.title,
    tab: g.tab,
    summary: g.summary,
  }))
}
