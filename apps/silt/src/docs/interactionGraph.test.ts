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
    expect(graph.reactions).toHaveLength(26)
    const keys = graph.reactions.map((edge) => `${edge.a}+${edge.b}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('marks products as unpaintable and the rail as paintable', () => {
    expect(graph.nodes.filter((node) => node.paintable)).toHaveLength(11)
    expect(graph.nodes.find((node) => node.name === 'obsidian')?.paintable).toBe(false)
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
    expect(pair('acid', 'wood')?.source).toBe('row 5 (acid + wood)')
    // The generic row it precedes digs a cavity instead.
    expect(products('acid', 'dirt')).toEqual(['empty', 'empty'])
  })

  it('expands fire + flammable to every fuel', () => {
    const fuels = graph.reactions
      .filter((edge) => edge.source.startsWith('row 3 '))
      .map((edge) => (edge.a === 'fire' ? edge.b : edge.a))

    expect(fuels.toSorted()).toEqual(['moss', 'oil', 'seed', 'sulphur', 'vine', 'wood'])
  })

  it('reads decay off the registry, fades included', () => {
    expect(graph.decays).toEqual([
      { from: 'fire', becomes: 'smoke', minTicks: 40, maxTicks: 60 },
      { from: 'smoke', becomes: 'empty', minTicks: 200, maxTicks: 255 },
      { from: 'steam', becomes: 'water', minTicks: 180, maxTicks: 240 },
    ])
  })

  /**
   * A coarse countdown (`every: n`) counts draws rather than ticks, so the
   * roster's numbers are in units of `n` and the doc has to multiply them back
   * out - a flower printed as "75-150 ticks" would be off by a factor of eight
   * (life ticket 03).
   */
  it('reports a coarse lifetime in real ticks, not in countdown draws', () => {
    expect(graph.decays.find((decay) => decay.from === 'flower')).toEqual({
      from: 'flower',
      becomes: 'seed',
      minTicks: 1200,
      maxTicks: 2400,
      // The death drop rides along on the lifetime, so it is reported with it -
      // a flower listed as decaying to a seed and nothing else would leave out
      // half of what a withering flower does (life ticket 04).
      emits: { species: 'petal', min: 3, max: 4 },
    })
    expect(graph.decays.find((decay) => decay.from === 'stalk')).toEqual({
      from: 'stalk',
      becomes: 'empty',
      minTicks: 2720,
      maxTicks: 3200,
    })
    // The tick-by-tick form is untouched: `every` defaults to 1.
    expect(graph.decays.find((decay) => decay.from === 'fire')?.minTicks).toBe(40)
  })

  it('declares the growth hook the registry cannot report', () => {
    expect(graph.growth.map((edge) => edge.grower)).toEqual(['moss', 'vine'])
    for (const edge of graph.growth) {
      expect(edge.consumes).toBe('water')
      expect(edge.becomes).toBe('vine')
    }
    // Burial is a row, so it arrives with the reactions and is not duplicated.
    // Germination is not: it is the seed bank's hook, and the graph has no shape
    // for a rule with two products, so `seedBank.ts` goes unreported here (life
    // ticket 02).
    expect(products('seed', 'mud')).toEqual(['empty', 'buried'])
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
