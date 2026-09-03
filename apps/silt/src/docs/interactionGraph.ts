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
import {
  createRegistry,
  EMPTY,
  MOSS,
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
  minTicks: number
  maxTicks: number
}

export interface GrowthEdge {
  grower: string
  consumes: string
  becomes: string
  p: number
}

export interface InteractionGraph {
  nodes: readonly GraphNode[]
  reactions: readonly ReactionEdge[]
  decays: readonly DecayEdge[]
  growth: readonly GrowthEdge[]
}

/**
 * The growth hook is code rather than a row - `createGrowth(WATER, MOSS, VINE)`
 * in `elements.ts` - so no registry lookup can report it and these edges are
 * declared. Mirror any change to `growth.ts` here. Sprouting (`seed + mud ->
 * moss`) is a reaction row and arrives with the rest.
 */
const GROWERS: readonly number[] = [MOSS, VINE]

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
    decays.push({
      from: def.name,
      becomes: nameOf(lifetime.becomes),
      minTicks: lifetime.ticks,
      maxTicks: lifetime.ticks + lifetime.jitter,
    })
  }

  const growth: GrowthEdge[] = GROWERS.map((grower) => ({
    grower: nameOf(grower),
    consumes: nameOf(WATER),
    becomes: nameOf(VINE),
    p: GROWTH_P,
  }))

  return { nodes, reactions, decays, growth }
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

function mermaid(graph: InteractionGraph): string {
  const lines = ['graph LR']
  for (const node of graph.nodes) lines.push(`  ${mermaidNode(node)}`)

  lines.push('', '  %% reactions')
  for (const edge of graph.reactions) {
    lines.push(`  ${edge.a} ---|"${edge.aBecomes} / ${edge.bBecomes}"| ${edge.b}`)
  }

  // A fade has no destination node, so it gets no edge - the table carries it.
  const shown = graph.decays.filter((decay) => decay.becomes !== CLEARED)
  if (shown.length > 0) {
    lines.push('', '  %% decay')
    for (const decay of shown) {
      lines.push(`  ${decay.from} -->|"decays, ${ticks(decay)}"| ${decay.becomes}`)
    }
  }

  if (graph.growth.length > 0) {
    lines.push('', '  %% growth')
    for (const edge of graph.growth) {
      lines.push(`  ${edge.consumes} -->|"beside ${edge.grower}, p ${edge.p}"| ${edge.becomes}`)
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
      outcome: `${decay.from} -> ${decay.becomes} after ${ticks(decay)}`,
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
"immune", and the first matching row winning. Growth is the one exception - it is
a hook in \`src/sim/growth.ts\` rather than a table row, so its edges are declared
in the generator and must be kept in step with it.

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
`
}
