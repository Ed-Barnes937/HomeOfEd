import type { ChoiceOption, ItemSchema, Params } from '../engine/schema.ts'
import { FAMILIES, type Family, familyOf } from './families.ts'

const CROSS_GUARDS = ['straight', 'curved', 'sCurve', 'winged']
const GROOVES = ['groove1', 'groove2', 'groove3', 'ridgeGroove']
const POMMEL_SEATS = ['wheel', 'ball', 'nut', 'pear', 'egg', 'cap']
const COLOURED_WRAPS = ['leather', 'cord', 'diamond']

export const isCurved = (p: Params) => familyOf(p).edges === 'single'
export const hasGroove = (p: Params) => GROOVES.includes(p.middle as string)
export const hasWaves = (p: Params) => p.waves === 'flame'
export const isCross = (p: Params) => CROSS_GUARDS.includes(p.guard as string)
export const hasRunes = (p: Params) => p.runes !== 'none'
export const hasGems = (p: Params) => p.gems !== 'none'
const pommelSeat = (p: Params) => POMMEL_SEATS.includes(p.pommel as string)
const guardSeat = (p: Params) => isCross(p) || p.guard === 'disc'
const runesMatchGems = (p: Params) => hasGems(p) && p.gemColour === 'runes'

const ricassoOptions = (p: Params) => {
  const own = familyOf(p).ricasso
  return hasWaves(p) ? own.filter((r) => r !== 'none') : own
}
const tipOptions = (p: Params): string[] =>
  familyOf(p).tip.filter((t) => t !== 'rounded' || (p.taper as number) <= 0.4)
const engravingAllowed = (p: Params) => !(hasRunes(p) && p.pattern === 'watered')

const named = (...values: string[]): ChoiceOption[] =>
  values.map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))

export const swordSchema: ItemSchema = {
  itemType: 'sword',
  groups: [
    { key: 'kind', label: 'Kind of sword' },
    { key: 'metal', label: 'The metal' },
    { key: 'blade', label: 'The blade' },
    { key: 'edge', label: 'Edge and tip' },
    { key: 'guard', label: 'The guard' },
    { key: 'grip', label: 'The grip' },
    { key: 'pommel', label: 'The pommel' },
    { key: 'extras', label: 'Finishing touches' },
  ],
  params: [
    {
      kind: 'choice',
      key: 'family',
      label: 'Kind of sword',
      group: 'kind',
      default: 'knight',
      options: (Object.keys(FAMILIES) as Family[]).map((value) => ({
        value,
        label: FAMILIES[value].label,
      })),
    },

    {
      kind: 'choice',
      key: 'steel',
      label: 'Steel',
      group: 'metal',
      default: 'satin',
      options: [
        { value: 'satin', label: 'Satin', weight: 6 },
        { value: 'bright', label: 'Mirror', weight: 3 },
        { value: 'dark', label: 'Black', weight: 2 },
        { value: 'silver', label: 'Silver', weight: 1 },
        { value: 'blue', label: 'Blue', weight: 1 },
      ],
    },
    {
      kind: 'choice',
      key: 'pattern',
      label: 'Pattern',
      group: 'metal',
      default: 'plain',
      options: [
        { value: 'plain', label: 'Plain', weight: 10 },
        { value: 'watered', label: 'Ripples', weight: 1 },
        { value: 'temper', label: 'Temper line', weight: 4 },
      ],
      allowed: (p) =>
        p.family === 'katana' && (p.steel === 'satin' || p.steel === 'bright')
          ? ['temper', 'plain', 'watered']
          : ['plain', 'watered'],
    },
    {
      kind: 'choice',
      key: 'fittings',
      label: 'Guard and pommel',
      group: 'metal',
      default: 'iron',
      options: [
        { value: 'iron', label: 'Iron', swatch: '#9a9da1' },
        { value: 'darkIron', label: 'Dark iron', swatch: '#3b3b40' },
        { value: 'brass', label: 'Brass', swatch: '#b39349' },
        { value: 'bronze', label: 'Bronze', swatch: '#9a6a3c' },
        { value: 'silver', label: 'Silver', swatch: '#c9ccd1' },
        { value: 'gold', label: 'Gold', swatch: '#d9a930' },
        { value: 'blue', label: 'Blue', swatch: '#2d3f6e' },
      ],
    },
    {
      kind: 'number',
      key: 'wear',
      label: 'Look',
      group: 'metal',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      ends: ['Brand new', 'Well loved'],
    },

    {
      kind: 'number',
      key: 'bladeLength',
      label: 'Length',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Short', 'Long'],
    },
    {
      kind: 'number',
      key: 'bladeWidth',
      label: 'Width',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Slim', 'Broad'],
    },
    {
      kind: 'number',
      key: 'taper',
      label: 'Shape',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Straight sides', 'Pointy'],
    },
    {
      kind: 'choice',
      key: 'profile',
      label: 'Outline',
      group: 'blade',
      default: 'straight',
      options: [
        ...named('straight', 'leaf'),
        { value: 'flared', label: 'Flared tip' },
        ...named('waisted'),
      ],
      allowed: (p) => familyOf(p).profile,
      visible: (p) => familyOf(p).profile.length > 1,
    },
    {
      kind: 'number',
      key: 'curve',
      label: 'Curve',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Gentle', 'Deep'],
      visible: isCurved,
    },
    {
      kind: 'choice',
      key: 'middle',
      label: 'Down the middle',
      group: 'blade',
      default: 'groove1',
      options: [
        ...named('flat', 'ridge'),
        { value: 'groove1', label: 'One groove' },
        { value: 'groove2', label: 'Two grooves' },
        { value: 'groove3', label: 'Three grooves' },
        { value: 'ridgeGroove', label: 'Ridge and groove' },
      ],
      allowed: (p) => familyOf(p).middle,
    },
    {
      kind: 'number',
      key: 'grooveLength',
      label: 'How far',
      group: 'blade',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Short', 'Long'],
      visible: hasGroove,
    },

    {
      kind: 'choice',
      key: 'tip',
      label: 'Tip',
      group: 'edge',
      default: 'sharp',
      options: [
        ...named('sharp'),
        { value: 'rounded', label: 'Round' },
        { value: 'longPoint', label: 'Long point' },
        { value: 'curvedPoint', label: 'Curved' },
        ...named('spear', 'clipped'),
        { value: 'kissaki', label: 'Angled' },
      ],
      allowed: tipOptions,
      visible: (p) => tipOptions(p).length > 1,
    },
    {
      kind: 'number',
      key: 'kissakiSize',
      label: 'Point size',
      group: 'edge',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      ends: ['Small', 'Big'],
      visible: (p) => p.family === 'katana',
    },
    {
      kind: 'choice',
      key: 'waves',
      label: 'Edges',
      group: 'edge',
      default: 'none',
      options: [
        { value: 'none', label: 'Smooth', weight: 11 },
        { value: 'flame', label: 'Wavy', weight: 1 },
      ],
      allowed: (p) => (familyOf(p).waves ? ['none', 'flame'] : ['none']),
      visible: (p) => familyOf(p).waves,
    },
    {
      kind: 'number',
      key: 'waveCount',
      label: 'How many waves',
      group: 'edge',
      min: 4,
      max: 16,
      step: 1,
      default: 9,
      ends: ['Few', 'Many'],
      visible: hasWaves,
    },
    {
      kind: 'choice',
      key: 'ricasso',
      label: 'Plain base',
      group: 'edge',
      default: 'none',
      options: named('none', 'short', 'long'),
      allowed: ricassoOptions,
      visible: (p) => ricassoOptions(p).length > 1,
    },

    {
      kind: 'choice',
      key: 'guard',
      label: 'Guard',
      group: 'guard',
      default: 'straight',
      options: [
        ...named('straight', 'curved'),
        { value: 'winged', label: 'Wings' },
        { value: 'sCurve', label: 'S shape' },
        ...named('dome'),
        { value: 'knuckleBow', label: 'Hand bow' },
        ...named('disc', 'swept', 'cup'),
      ],
      allowed: (p) => familyOf(p).guard,
      visible: (p) => familyOf(p).guard.length > 1,
    },
    {
      kind: 'number',
      key: 'guardWidth',
      label: 'Guard size',
      group: 'guard',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Small', 'Wide'],
    },
    {
      kind: 'number',
      key: 'guardBend',
      label: 'How bent',
      group: 'guard',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.4,
      ends: ['A little', 'A lot'],
      visible: (p) => p.guard === 'curved',
    },
    {
      kind: 'choice',
      key: 'guardEnds',
      label: 'Ends',
      group: 'guard',
      default: 'plain',
      options: [
        ...named('plain', 'knobs', 'flared', 'curls'),
        { value: 'fourLeaves', label: 'Four leaves' },
        ...named('drops'),
      ],
      visible: isCross,
    },
    {
      kind: 'choice',
      key: 'discShape',
      label: 'Disc shape',
      group: 'guard',
      default: 'round',
      options: [
        ...named('round'),
        { value: 'roundedSquare', label: 'Rounded square' },
        ...named('flower'),
      ],
      visible: (p) => p.guard === 'disc',
    },
    {
      kind: 'choice',
      key: 'langets',
      label: 'Tabs',
      group: 'guard',
      default: 'none',
      options: named('none', 'short', 'long'),
      allowed: (p) => (familyOf(p).langets ? ['none', 'short', 'long'] : ['none']),
      visible: (p) => familyOf(p).langets,
    },

    {
      kind: 'number',
      key: 'gripLength',
      label: 'Grip',
      group: 'grip',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Snug', 'Roomy'],
    },
    {
      kind: 'choice',
      key: 'wrap',
      label: 'Wrapped in',
      group: 'grip',
      default: 'leather',
      options: [
        ...named('leather', 'cord', 'wire', 'wood'),
        { value: 'ribbed', label: 'Ridges' },
        { value: 'diamond', label: 'Diamond wrap' },
      ],
      allowed: (p) => familyOf(p).wrap,
      visible: (p) => familyOf(p).wrap.length > 1,
    },
    {
      kind: 'choice',
      key: 'gripColour',
      label: 'Grip colour',
      group: 'grip',
      default: 'saddle',
      options: [
        { value: 'saddle', label: 'Saddle', swatch: '#7a4a2a' },
        { value: 'black', label: 'Black', swatch: '#1f1a17' },
        { value: 'oxblood', label: 'Oxblood', swatch: '#5a1f1c' },
        { value: 'navy', label: 'Navy', swatch: '#1e2a44' },
        { value: 'forest', label: 'Forest', swatch: '#26402c' },
        { value: 'undyed', label: 'Undyed', swatch: '#c7a77c' },
      ],
      visible: (p) => COLOURED_WRAPS.includes(p.wrap as string),
    },
    {
      kind: 'choice',
      key: 'gripShape',
      label: 'Grip shape',
      group: 'grip',
      default: 'straight',
      options: [
        ...named('straight'),
        { value: 'swelling', label: 'Fat middle' },
        { value: 'waisted', label: 'Thin middle' },
      ],
    },

    {
      kind: 'choice',
      key: 'pommel',
      label: 'Pommel',
      group: 'pommel',
      default: 'wheel',
      options: named(
        'wheel',
        'ball',
        'pear',
        'nut',
        'cap',
        'egg',
        'fishtail',
        'lobed',
        'block',
        'ring',
      ),
      allowed: (p) => familyOf(p).pommel,
      visible: (p) => familyOf(p).pommel.length > 1,
    },
    {
      kind: 'number',
      key: 'pommelSize',
      label: 'Pommel size',
      group: 'pommel',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      ends: ['Small', 'Big'],
    },

    {
      kind: 'choice',
      key: 'runes',
      label: 'Runes',
      group: 'extras',
      default: 'none',
      options: [
        { value: 'none', label: 'None', weight: 7 },
        { value: 'groove', label: 'In the groove' },
        { value: 'base', label: 'Near the guard' },
        { value: 'centre', label: 'Down the middle' },
      ],
      allowed: (p) => [
        'none',
        ...(hasGroove(p) ? ['groove'] : []),
        'base',
        ...((p.middle === 'flat' || p.middle === 'ridge') &&
        p.pattern !== 'watered' &&
        p.family !== 'katana'
          ? ['centre']
          : []),
      ],
    },
    {
      kind: 'choice',
      key: 'runeColour',
      label: 'Rune glow',
      group: 'extras',
      default: 'moonstone',
      options: [
        { value: 'starlight', label: 'Starlight', swatch: '#ffc95c' },
        { value: 'moonstone', label: 'Moonstone', swatch: '#8fe3ff' },
        { value: 'wildwood', label: 'Wildwood', swatch: '#6dff9c' },
        { value: 'stormglass', label: 'Storm glass', swatch: '#c49bff' },
        { value: 'emberstone', label: 'Emberstone', swatch: '#ff7a45' },
      ],
      visible: (p) => hasRunes(p) || runesMatchGems(p),
    },
    {
      kind: 'choice',
      key: 'gems',
      label: 'Gems',
      group: 'extras',
      default: 'none',
      options: [
        { value: 'none', label: 'None', weight: 9 },
        { value: 'pommel', label: 'In the pommel' },
        { value: 'guard', label: 'In the guard' },
        { value: 'both', label: 'Both' },
      ],
      allowed: (p) => [
        'none',
        ...(pommelSeat(p) ? ['pommel'] : []),
        ...(guardSeat(p) ? ['guard'] : []),
        ...(pommelSeat(p) && guardSeat(p) ? ['both'] : []),
      ],
    },
    {
      kind: 'choice',
      key: 'gemCut',
      label: 'Gem cut',
      group: 'extras',
      default: 'round',
      options: [
        { value: 'round', label: 'Round', weight: 4 },
        { value: 'square', label: 'Square' },
        { value: 'marquise', label: 'Leaf' },
      ],
      visible: hasGems,
    },
    {
      kind: 'choice',
      key: 'gemColour',
      label: 'Gem colour',
      group: 'extras',
      default: 'runes',
      options: [
        { value: 'runes', label: 'Match the runes', weight: 8 },
        { value: 'amethyst', label: 'Amethyst', swatch: '#8e4fd1' },
        { value: 'emerald', label: 'Emerald', swatch: '#1f9e5a' },
        { value: 'ruby', label: 'Ruby', swatch: '#c0183c' },
        { value: 'sapphire', label: 'Sapphire', swatch: '#2546b8' },
        { value: 'citrine', label: 'Citrine', swatch: '#e0821c' },
        { value: 'clear', label: 'Clear', swatch: '#e6edf2' },
        { value: 'smoky', label: 'Smoky', swatch: '#5c4a3e' },
      ],
      visible: hasGems,
    },
    {
      kind: 'choice',
      key: 'engraving',
      label: 'Engraving',
      group: 'extras',
      default: 'none',
      options: [
        { value: 'none', label: 'None', weight: 12 },
        ...named('vine', 'knotwork', 'scales', 'dots'),
      ],
      allowed: (p) =>
        engravingAllowed(p) ? ['none', 'vine', 'knotwork', 'scales', 'dots'] : ['none'],
      visible: engravingAllowed,
    },
  ],
}

export const swordSwatchFor = (key: string, value: string): string | undefined => {
  const def = swordSchema.params.find((d) => d.key === key)
  return def?.kind === 'choice' ? def.options.find((o) => o.value === value)?.swatch : undefined
}
