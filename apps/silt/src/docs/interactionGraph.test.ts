import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  deriveInteractionGraph,
  GRAPH_COMMAND,
  renderInteractionGraph,
  type ReactionEdge,
} from './interactionGraph.ts'

const graph = deriveInteractionGraph()

const pair = (a: string, b: string): ReactionEdge | undefined =>
  graph.reactions.find((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a))

/** The edge's products, in the order the reagents were asked for. */
const products = (a: string, b: string): [string, string] | undefined => {
  const edge = pair(a, b)
  if (!edge) return undefined
  return edge.a === a ? [edge.aBecomes, edge.bBecomes] : [edge.bBecomes, edge.aBecomes]
}

describe('the interaction graph doc', () => {
  it('matches the checked-in file', () => {
    const checkedIn = readFileSync(
      new URL('../../docs/interaction-graph.md', import.meta.url),
      'utf8',
    )

    expect(checkedIn, `docs/interaction-graph.md is stale - run \`${GRAPH_COMMAND}\``).toBe(
      renderInteractionGraph(graph),
    )
  })
})

describe('deriveInteractionGraph', () => {
  it('finds every registered pair once, unordered', () => {
    // Registry-derived, so this count moves only when the chemistry does.
    expect(graph.reactions).toHaveLength(32)
    const keys = graph.reactions.map((edge) => `${edge.a}+${edge.b}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('marks products as unpaintable and the rail as paintable', () => {
    // Ten since the discovery tree took mud out of the base rail (spec §9.5) -
    // read off `PAINTABLE_IDS` at runtime, so an earned unlock never shows here.
    expect(graph.nodes.filter((node) => node.paintable)).toHaveLength(10)
    expect(graph.nodes.find((node) => node.name === 'obsidian')?.paintable).toBe(false)
    expect(graph.nodes.find((node) => node.name === 'mud')?.paintable).toBe(false)
    expect(graph.nodes.find((node) => node.name === 'water')?.paintable).toBe(true)
  })

  it('omits pairs maxHardness never registered', () => {
    expect(pair('acid', 'stone')).toBeUndefined()
    expect(pair('acid', 'obsidian')).toBeUndefined()
    expect(pair('acid', 'sulphur')).toBeUndefined()
    // The pairs the same rows *do* cover are there.
    expect(pair('acid', 'dirt')).toBeDefined()
  })

  it('keeps the first matching row, so acid + wood leaves sulphur', () => {
    expect(products('acid', 'wood')).toEqual(['sulphur', 'empty'])
    expect(pair('acid', 'wood')?.source).toBe('row 15 (acid + wood)')
    // The generic row it precedes digs a cavity instead.
    expect(products('acid', 'dirt')).toEqual(['empty', 'empty'])
  })

  it('expands lava + flammable to every fuel a specific row has not already claimed', () => {
    // Burnables broke `fire + flammable` up into a per-fuel ignition ladder
    // (ADR 0042), so `lava + flammable` is the tag row left to expand - and
    // wood is absent from it because `lava + wood` (chars it to ember) precedes.
    const fuels = graph.reactions
      .filter((edge) => edge.source.endsWith('(lava + flammable)'))
      .map((edge) => (edge.a === 'lava' ? edge.b : edge.a))

    expect(fuels.toSorted()).toEqual(['moss', 'oil', 'seed', 'sulphur', 'vine'])
  })

  it('reads decay off the registry, fades included', () => {
    expect(graph.decays).toEqual([
      { from: 'fire', becomes: 'smoke', minTicks: 40, maxTicks: 60 },
      { from: 'smoke', becomes: 'empty', minTicks: 200, maxTicks: 255 },
      { from: 'steam', becomes: 'water', minTicks: 180, maxTicks: 240 },
      { from: 'ember', becomes: 'fire', minTicks: 120, maxTicks: 180 },
    ])
  })

  it('declares the growth hook the registry cannot report', () => {
    expect(graph.growth.map((edge) => edge.grower)).toEqual(['moss', 'vine'])
    for (const edge of graph.growth) {
      expect(edge.consumes).toBe('water')
      expect(edge.becomes).toBe('vine')
    }
    // Sprouting is a row, so it arrives with the reactions and is not duplicated.
    expect(products('seed', 'mud')).toEqual(['moss', 'mud'])
  })
})

describe('renderInteractionGraph', () => {
  it('names the regen command and fences one mermaid graph', () => {
    const markdown = renderInteractionGraph(graph)

    expect(markdown.split('\n')[0]).toContain(GRAPH_COMMAND)
    expect(markdown.match(/```mermaid/g)).toHaveLength(1)
    // A fade has nowhere to point, so it stays out of the graph.
    expect(markdown).not.toContain('smoke -->')
  })
})
