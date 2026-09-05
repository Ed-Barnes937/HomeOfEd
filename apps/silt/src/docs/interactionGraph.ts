/**
 * The generator behind `docs/interaction-graph.md` (`pnpm --filter silt run
 * graph`). Pure and DOM-free, and it never touches the filesystem: the writer in
 * `scripts/interaction-graph.ts` does that, and `interactionGraph.test.ts`
 * compares the checked-in file against `renderInteractionGraph()`.
 *
 * **Edges come from the registry, never from re-reading the rows.** Asking
 * `createRegistry(v1Elements, v1Reactions)` for every ordered pair is what makes
 * the doc report the chemistry the sim actually resolves: tag rows expanded
 * (`fire + [flammable]` covers six fuels), `maxHardness` pairs never registered
 * (acid + stone is absent, not "immune"), and first-row-wins precedence applied
 * (acid + wood leaves sulphur, not the generic `[solid]` cavity).
 */
import { PAINTABLE_IDS } from '../features/palette/paletteGroups.ts'
import { GROWTH_P } from '../sim/growth.ts'
import { GERMINATE_P } from '../sim/seedBank.ts'
import {
  BURIED,
  createRegistry,
  EMPTY,
  FLOWER,
  MOSS,
  PETAL,
  SEED,
  SPROUT,
  STALK,
  TIP,
  VINE,
  WATER,
  v1Elements,
  v1Reactions,
  type ElementRegistry,
  type ReactionRow,
} from '../sim/index.ts'

/** The command that rewrites the doc; named in its header and in the drift test. */
export const GRAPH_COMMAND = 'pnpm --filter silt run graph'

/** Repo-relative home of the generated file, for the header and the writer. */
export const GRAPH_DOC_PATH = 'apps/silt/docs/interaction-graph.md'

/** How a cleared cell is written wherever a product is named. */
const CLEARED = 'empty'

export interface GraphNode {
  id: number
  name: string
  /** In the rail (`PAINTABLE_IDS`), as opposed to reachable only by reacting. */
  paintable: boolean
}

/** One unordered pair the registry holds a rule for. Products are element names, or `empty`. */
export interface ReactionEdge {
  a: string
  b: string
  p: number
  aBecomes: string
  bBecomes: string
  /** The table row that registered the pair, for attribution only. */
  source: string
}

export interface DecayEdge {
  from: string
  /** `empty` for a fade: smoke leaves nothing behind. */
  becomes: string
  /**
   * **Real ticks, not countdown draws.** A coarse lifetime (`every: n`) counts
   * draws in the byte, so its `ticks` and `jitter` are in units of `n` - a doc
   * that printed them raw would report a 600-tick flower as a 75-tick one (life
   * ticket 03).
   */
  minTicks: number
  maxTicks: number
  /**
   * The brood thrown clear of the cell on death (`lifetime.emits`, life ticket
   * 04), where `becomes` is only what is left *in* it. Reported because it is
   * registry state like the rest of the lifetime - a flower listed as decaying
   * to a seed and nothing else would be a doc that misses half of what happens.
   */
  emits?: { species: string; min: number; max: number }
}

export interface GrowthEdge {
  grower: string
  consumes: string
  becomes: string
  p: number
}

/**
 * A transmutation performed by an `onTick` hook that neither a `GrowthEdge` nor
 * any registry lookup can carry: germination writes two cells and depends on
 * soak history, the raise and the bloom each transmute the cell *and* (for the
 * raise) write another. The shape ADR 0043 said the third such hook would force,
 * landed with discovery ticket 07.
 *
 * `kind` and `name` are the two halves of the canonical entry key
 * (`germinate:moss`, `raise:sprout`, `bloom:tip`); reagents and products are
 * what field notes counts. `outcome` is the doc table's whole outcome column,
 * condition included, because a hook's condition is code no derivation can read.
 */
export interface HookEdge {
  kind: 'germinate' | 'raise' | 'bloom'
  /** The name half of the key: the plant germinated, the sprout, the tip. */
  name: string
  reagents: readonly string[]
  products: readonly string[]
  /** Per-tick probability once the condition holds; absent when the hook fires on sight. */
  p?: number
  /** The outcome as the doc table prints it. */
  outcome: string
  /** The module whose hook performs it, for attribution. */
  source: string
}

export interface InteractionGraph {
  nodes: readonly GraphNode[]
  reactions: readonly ReactionEdge[]
  decays: readonly DecayEdge[]
  growth: readonly GrowthEdge[]
  hooks: readonly HookEdge[]
  /**
   * Species this chart does not name, and the element each belongs to
   * (`CHARTED_AS`). Everything else here is raw; this is the one presentation
   * concern the graph carries, because the mapping is roster knowledge and the
   * roster is what this module owns.
   */
  chartAs: ReadonlyMap<string, string>
}

/**
 * **Charted identities** (discovery ticket 08). The sim's unit is a species -
 * `buried` exists because a soak counter needs a byte to live in (ADR 0043) -
 * but the player's unit is an element, and `buried` is not a thing you can
 * have: it is what a seed does in mud. Sprout, tip, stalk and petal are stages
 * and parts of one plant, split into species by that same byte-ownership rule.
 *
 * So field notes charts each of them as the element it belongs to, and does it
 * here rather than in the sim: nothing below changes (the doc reports the
 * chemistry as it resolves, stage rows and all), the witness keys the store
 * holds stay raw and name-based, and `features/fieldNotes/entries.ts` folds the
 * mapping in as it derives its entries. Nothing migrates.
 *
 * Ids rather than names, so a rename cannot leave the mapping pointing at a
 * species that no longer exists.
 */
const CHARTED_AS: readonly (readonly [species: number, charted: number])[] = [
  [BURIED, SEED],
  [SPROUT, FLOWER],
  [TIP, FLOWER],
  [STALK, FLOWER],
  [PETAL, FLOWER],
]

/**
 * The growth hook is code rather than a row - `createGrowth(WATER, MOSS, VINE)`
 * in `elements.ts` - so no registry lookup can report it and these edges are
 * declared. Mirror any change to `growth.ts` here. Burial (`seed + mud ->
 * buried`) is a reaction row and arrives with the rest.
 *
 * The other hook transmutations - germination (`seedBank.ts`) and the land
 * plant's raise and bloom (`stalk.ts`) - are declared too, as `HookEdge`s
 * (discovery ticket 07): no existing shape could carry a rule that writes two
 * cells or depends on soak history, and leaving them out made the five
 * hook-born elements undiscoverable. Mirror any change to those two modules in
 * `hookEdges` below.
 *
 * Two hook behaviours stay deliberately unreported: the tip's *climb* (it
 * leaves stalk behind, but stalk is already the raise's product, and a climb is
 * movement to the player's eye, not a new transmutation) and evaporation
 * (`evaporation.ts`), which produces nothing at all - a fade, like smoke's, and
 * a fade is not an entry (spec §1).
 */
const GROWERS: readonly number[] = [MOSS, VINE]

/**
 * The hook transmutations a player can witness, one entry each - the minimum
 * set that makes every hook-born element the product of something (ticket 07).
 * The dirt refund on germination is not listed as a product: dirt is pre-known,
 * and the entry is about what came *up*.
 */
function hookEdges(nameOf: (id: number) => string): readonly HookEdge[] {
  return [
    {
      kind: 'germinate',
      name: nameOf(MOSS),
      reagents: [nameOf(BURIED), nameOf(WATER)],
      products: [nameOf(MOSS)],
      p: GERMINATE_P,
      outcome: `${nameOf(WATER)} above -> ${nameOf(MOSS)}, ${nameOf(BURIED)} -> dirt (soaked 120 ticks under 2 cells of standing water)`,
      source: 'seedBank.ts',
    },
    {
      kind: 'germinate',
      name: nameOf(SPROUT),
      reagents: [nameOf(BURIED)],
      products: [nameOf(SPROUT)],
      p: GERMINATE_P,
      outcome: `air above -> ${nameOf(SPROUT)}, ${nameOf(BURIED)} -> dirt (sky open, no standing water)`,
      source: 'seedBank.ts',
    },
    {
      kind: 'raise',
      name: nameOf(SPROUT),
      reagents: [nameOf(SPROUT)],
      products: [nameOf(TIP), nameOf(STALK)],
      outcome: `air above -> ${nameOf(TIP)}, ${nameOf(SPROUT)} -> ${nameOf(STALK)} (on the first tick the sky above is open)`,
      source: 'stalk.ts',
    },
    {
      kind: 'bloom',
      name: nameOf(TIP),
      reagents: [nameOf(TIP)],
      products: [nameOf(FLOWER)],
      outcome: `${nameOf(TIP)} -> ${nameOf(FLOWER)} (budget spent, or boxed in)`,
      source: 'stalk.ts',
    },
  ]
}

/**
 * Whether `row` covers the unordered pair - the same test `resolvePairs` applies,
 * so "which row won" agrees with the registry. Attribution only: the products
 * come from the registry either way.
 */
function rowCovers(
  registry: ElementRegistry,
  row: ReactionRow,
  a: number,
  b: number,
  names: ReadonlyMap<string, number>,
): boolean {
  // A side that names an element never falls through to tag matching, exactly as
  // `sidesOf` resolves it.
  const matches = (side: string, id: number) =>
    names.has(side) ? names.get(side) === id : registry.has(id, side)
  const within = (id: number) =>
    row.maxHardness === undefined || (registry.get(id)?.hardness ?? 0) <= row.maxHardness
  if (!within(a) || !within(b)) return false
  return (matches(row.a, a) && matches(row.b, b)) || (matches(row.a, b) && matches(row.b, a))
}

/** Derives the whole graph from the live registry. */
export function deriveInteractionGraph(): InteractionGraph {
  const registry = createRegistry(v1Elements, v1Reactions)
  const roster = registry.all()
  const nameOf = (id: number): string => (id === EMPTY ? CLEARED : registry.get(id)!.name)
  const names = new Map(roster.map((def) => [def.name, def.id]))

  const nodes: GraphNode[] = roster.map((def) => ({
    id: def.id,
    name: def.name,
    paintable: PAINTABLE_IDS.includes(def.id),
  }))

  // Every ordered pair, then folded onto the canonical id order. Both
  // orientations are registered together, so either one names the same rule.
  const reactions: ReactionEdge[] = []
  for (const a of roster) {
    for (const b of roster) {
      if (b.id < a.id) continue
      const reaction = registry.reactionFor(a.id, b.id)
      if (!reaction) continue
      const index = v1Reactions.findIndex((row) => rowCovers(registry, row, a.id, b.id, names))
      reactions.push({
        a: a.name,
        b: b.name,
        p: reaction.p,
        aBecomes: nameOf(reaction.aBecomes),
        bBecomes: nameOf(reaction.bBecomes),
        source:
          index === -1
            ? 'reaction table'
            : `row ${index + 1} (${v1Reactions[index]!.a} + ${v1Reactions[index]!.b})`,
      })
    }
  }

  const decays: DecayEdge[] = []
  for (const def of roster) {
    const lifetime = registry.lifetimeOf(def.id)
    if (!lifetime) continue
    const { emits } = lifetime
    decays.push({
      from: def.name,
      becomes: nameOf(lifetime.becomes),
      minTicks: lifetime.ticks * lifetime.every,
      maxTicks: (lifetime.ticks + lifetime.jitter) * lifetime.every,
      ...(emits && {
        emits: { species: nameOf(emits.species), min: emits.min, max: emits.max },
      }),
    })
  }

  const growth: GrowthEdge[] = GROWERS.map((grower) => ({
    grower: nameOf(grower),
    consumes: nameOf(WATER),
    becomes: nameOf(VINE),
    p: GROWTH_P,
  }))

  return {
    nodes,
    reactions,
    decays,
    growth,
    hooks: hookEdges(nameOf),
    chartAs: new Map(CHARTED_AS.map(([species, charted]) => [nameOf(species), nameOf(charted)])),
  }
}

/** Mermaid node ids are the element names, which are single words by contract. */
function mermaidNode(node: GraphNode): string {
  // Rounded for the rail, hexagonal for a product: the shape is the legend, so
  // the graph stays readable without colour (GitHub renders it in both themes).
  return node.paintable ? `${node.name}("${node.name}")` : `${node.name}{{"${node.name}"}}`
}

function ticks(decay: DecayEdge): string {
  return decay.minTicks === decay.maxTicks
    ? `${decay.minTicks} ticks`
    : `${decay.minTicks}-${decay.maxTicks} ticks`
}

/** How many of the brood a death throws clear: "3" or "3-4". */
function broodSize(emits: NonNullable<DecayEdge['emits']>): string {
  return emits.min === emits.max ? `${emits.min}` : `${emits.min}-${emits.max}`
}

function mermaid(graph: InteractionGraph): string {
  const lines = ['graph LR']
  for (const node of graph.nodes) lines.push(`  ${mermaidNode(node)}`)

  lines.push('', '  %% reactions')
  for (const edge of graph.reactions) {
    lines.push(`  ${edge.a} ---|"${edge.aBecomes} / ${edge.bBecomes}"| ${edge.b}`)
  }

  // A fade has no destination node, so it gets no edge - the table carries it.
  // The brood does have one, on a species that fades: a flower's petals are an
  // edge even though the flower's own cell is not.
  const shown = graph.decays.filter((decay) => decay.becomes !== CLEARED || decay.emits)
  if (shown.length > 0) {
    lines.push('', '  %% decay')
    for (const decay of shown) {
      if (decay.becomes !== CLEARED) {
        lines.push(`  ${decay.from} -->|"decays, ${ticks(decay)}"| ${decay.becomes}`)
      }
      if (decay.emits) {
        // The edge already points at the species, so the label only counts.
        lines.push(`  ${decay.from} -->|"sheds ${broodSize(decay.emits)}"| ${decay.emits.species}`)
      }
    }
  }

  if (graph.growth.length > 0) {
    lines.push('', '  %% growth')
    for (const edge of graph.growth) {
      lines.push(`  ${edge.consumes} -->|"beside ${edge.grower}, p ${edge.p}"| ${edge.becomes}`)
    }
  }

  if (graph.hooks.length > 0) {
    lines.push('', '  %% hook transmutations')
    for (const edge of graph.hooks) {
      // One arrow per product, from the cell whose hook fired. 'germinate' +
      // 's' and friends all read as verbs, which is what the label needs.
      const label = edge.p === undefined ? `${edge.kind}s` : `${edge.kind}s, p ${edge.p}`
      for (const product of edge.products) {
        lines.push(`  ${edge.reagents[0]} -->|"${label}"| ${product}`)
      }
    }
  }

  return lines.join('\n')
}

interface Row {
  reagents: string
  p: string
  outcome: string
  mechanism: string
}

function rows(graph: InteractionGraph): Row[] {
  const table: Row[] = graph.reactions.map((edge) => ({
    reagents: `${edge.a} + ${edge.b}`,
    p: String(edge.p),
    outcome: `${edge.a} -> ${edge.aBecomes}, ${edge.b} -> ${edge.bBecomes}`,
    mechanism: `reaction ${edge.source}`,
  }))

  for (const decay of graph.decays) {
    table.push({
      reagents: decay.from,
      // Decay is certain once the countdown runs out; the spread is in the outcome.
      p: '-',
      outcome:
        `${decay.from} -> ${decay.becomes} after ${ticks(decay)}` +
        (decay.emits ? `, shedding ${broodSize(decay.emits)} ${decay.emits.species}` : ''),
      mechanism: 'lifetime',
    })
  }

  for (const edge of graph.growth) {
    table.push({
      reagents: `${edge.grower} + ${edge.consumes}`,
      p: String(edge.p),
      outcome: `${edge.consumes} -> ${edge.becomes}`,
      mechanism: 'growth hook (growth.ts)',
    })
  }

  for (const edge of graph.hooks) {
    table.push({
      reagents: edge.reagents.join(' + '),
      p: edge.p === undefined ? '-' : String(edge.p),
      outcome: edge.outcome,
      mechanism: `${edge.kind} hook (${edge.source})`,
    })
  }

  return table
}

/**
 * A pipe table with the columns padded to width, which is the shape Prettier
 * formats markdown tables into. Emitting it directly keeps `prettier --write`
 * from rewriting the generated file out from under the drift test.
 */
function markdownTable(header: readonly string[], body: readonly (readonly string[])[]): string {
  const widths = header.map((cell, column) =>
    Math.max(3, cell.length, ...body.map((row) => row[column]!.length)),
  )
  const line = (cells: readonly string[]) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column]!)).join(' | ')} |`
  return [
    line(header),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...body.map(line),
  ].join('\n')
}

function table(graph: InteractionGraph): string {
  return markdownTable(
    ['reagents', 'p', 'outcome', 'mechanism'],
    rows(graph).map((row) => [row.reagents, row.p, row.outcome, row.mechanism]),
  )
}

/** The charted identities as a table: the species, and the element it is named as. */
function chartedTable(graph: InteractionGraph): string {
  return markdownTable(
    ['species', 'charted as'],
    [...graph.chartAs].map(([species, name]) => [species, name]),
  )
}

function summary(graph: InteractionGraph): string {
  const paintable = graph.nodes.filter((node) => node.paintable).length
  const fades = graph.decays.filter((decay) => decay.becomes === CLEARED).length
  const counts: readonly [string, number][] = [
    ['elements', graph.nodes.length],
    ['paintable', paintable],
    ['products only', graph.nodes.length - paintable],
    ['reaction pairs', graph.reactions.length],
    ['decays', graph.decays.length],
    ['of which fade to nothing', fades],
    ['growth edges', graph.growth.length],
    ['hook transmutations', graph.hooks.length],
  ]
  return markdownTable(
    ['', 'count'],
    counts.map(([label, count]) => [label, String(count)]),
  )
}

/** The whole markdown document, newline-terminated. */
export function renderInteractionGraph(graph = deriveInteractionGraph()): string {
  return `<!-- Generated by \`${GRAPH_COMMAND}\` - do not hand-edit. -->

# silt element interactions

Every reaction and decay below is read back out of the live registry
(\`createRegistry(v1Elements, v1Reactions)\`), so what is listed is what the sim
resolves: tag rows already expanded, \`maxHardness\` pairs absent rather than
"immune", and the first matching row winning. The hooks are the exception - growth
(\`src/sim/growth.ts\`), germination (\`src/sim/seedBank.ts\`) and the land plant's
raise and bloom (\`src/sim/stalk.ts\`) are code rather than table rows, so their
edges are declared in the generator and must be kept in step with them.

## Summary

${summary(graph)}

## Graph

\`\`\`mermaid
${mermaid(graph)}
\`\`\`

Rounded nodes are paintable (the rail's \`PAINTABLE_IDS\`); hexagons are reachable
only by reacting. A reaction edge is undirected and its label reads
\`<what the left node becomes> / <what the right node becomes>\`, where
\`${CLEARED}\` means the cell is cleared. Decay and growth edges are directed.

## Interactions

${table(graph)}

## Charted as

Everything above is the sim's own vocabulary, where a species owns a byte
(ADR 0043). Field notes charts these ones as the element they belong to, so the
player's chart counts a flower rather than four of its parts (discovery ticket
08). Presentation only: the chemistry above and the witnessed edge keys are
unaffected.

${chartedTable(graph)}
`
}
