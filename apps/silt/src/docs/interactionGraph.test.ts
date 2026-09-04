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

describe('charted identities', () => {
  /**
   * Ticket 08: the species the sim keeps because a byte needs an owner (ADR
   * 0043), named as the element a player actually holds. Presentation only -
   * the chemistry below is derived raw, and the witness keys stay raw with it.
   */
  it('names a bookkeeping species as the element it belongs to', () => {
    expect(Object.fromEntries(graph.chartAs)).toEqual({
      buried: 'seed',
      sprout: 'flower',
      tip: 'flower',
      stalk: 'flower',
      petal: 'flower',
    })
  })

  it('charts onto real elements, and never onto another charted one', () => {
    const names = new Set(graph.nodes.map((node) => node.name))
    for (const [species, charted] of graph.chartAs) {
      expect(names.has(species)).toBe(true)
      expect(names.has(charted)).toBe(true)
      // A chain would make the mapping order-dependent; one hop is the contract.
      expect(graph.chartAs.has(charted)).toBe(false)
    }
  })

  it('leaves the graph itself raw: the doc reports the chemistry, not the chart', () => {
    expect(graph.nodes.map((node) => node.name)).toContain('buried')
    expect(pair('lava', 'stalk')).toBeDefined()
    expect(pair('lava', 'flower')).toBeDefined()
  })
})

describe('deriveInteractionGraph', () => {
  it('finds every registered pair once, unordered', () => {
    // Registry-derived, so this count moves only when the chemistry does.
    expect(graph.reactions).toHaveLength(48)
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
    expect(pair('acid', 'wood')?.source).toBe('row 17 (acid + wood)')
    // The generic row it precedes digs a cavity instead.
    expect(products('acid', 'dirt')).toEqual(['empty', 'empty'])
  })

  it('gives every fuel on the ignition ladder its own row, ahead of the flammable fallback', () => {
    // Burnables gave each historical fuel its own probability (spec §1), and the
    // land plant's wet tissue steams on its own rows too, so the generic
    // `fire + flammable` tag row (still present for the next fuel that arrives
    // without one) never wins attribution for any of these eight today.
    const laddered = graph.reactions
      .filter(
        (edge) =>
          edge.source.includes('(fire + ') &&
          !edge.source.includes('flammable') &&
          !edge.source.includes('ember'),
      )
      .map((edge) => (edge.a === 'fire' ? edge.b : edge.a))

    expect(laddered.toSorted()).toEqual([
      'flower',
      'moss',
      'oil',
      'seed',
      'sprout',
      'sulphur',
      'vine',
      'wood',
    ])
  })

  it('expands fire + flammable to the fuels without a ladder row of their own', () => {
    // The ignition ladder (burnables) gives each fuel its own preceding row, so
    // the tag row is the fallback and only stalk and tip still fall through to
    // it - the land plant's dry tissue, burning at the generic rate.
    const fuels = graph.reactions
      .filter((edge) => edge.source.endsWith('(fire + flammable)'))
      .map((edge) => (edge.a === 'fire' ? edge.b : edge.a))

    expect(fuels.toSorted()).toEqual(['stalk', 'tip'])
  })

  it('expands lava + flammable to every fuel a specific row has not already claimed', () => {
    // Burnables broke `fire + flammable` up into a per-fuel ignition ladder
    // (ADR 0042), so `lava + flammable` is the tag row left to expand - and
    // wood is absent from it because `lava + wood` (chars it to ember) precedes.
    const fuels = graph.reactions
      .filter((edge) => edge.source.endsWith('(lava + flammable)'))
      .map((edge) => (edge.a === 'lava' ? edge.b : edge.a))

    expect(fuels.toSorted()).toEqual([
      'flower',
      'moss',
      'oil',
      'seed',
      'sprout',
      'stalk',
      'sulphur',
      'tip',
      'vine',
    ])
  })

  it('reads decay off the registry, fades included', () => {
    expect(graph.decays).toEqual([
      { from: 'fire', becomes: 'smoke', minTicks: 40, maxTicks: 60 },
      { from: 'smoke', becomes: 'empty', minTicks: 200, maxTicks: 255 },
      { from: 'steam', becomes: 'water', minTicks: 180, maxTicks: 240 },
      { from: 'seed', becomes: 'empty', minTicks: 1280, maxTicks: 2000 },
      { from: 'ember', becomes: 'fire', minTicks: 120, maxTicks: 180 },
      { from: 'stalk', becomes: 'empty', minTicks: 2720, maxTicks: 3200 },
      {
        from: 'flower',
        becomes: 'seed',
        minTicks: 1200,
        maxTicks: 2400,
        emits: { species: 'petal', min: 3, max: 4 },
      },
      { from: 'petal', becomes: 'empty', minTicks: 80, maxTicks: 150 },
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
    // Burial is a row, so it arrives with the reactions and is not duplicated;
    // germination is a hook edge below, not a second reaction.
    expect(products('seed', 'mud')).toEqual(['empty', 'buried'])
  })

  /**
   * The hook transmutations (discovery ticket 07): the entries that make every
   * hook-born element the product of something. Pinned whole because they are
   * declared, not derived - a change to `seedBank.ts` or `stalk.ts` has to be
   * mirrored here by hand, and this fixture is what says so out loud.
   */
  it('declares the four hook edges: two germinations, the raise and the bloom', () => {
    expect(
      graph.hooks.map((edge) => ({
        key: `${edge.kind}:${edge.name}`,
        reagents: edge.reagents,
        products: edge.products,
      })),
    ).toEqual([
      { key: 'germinate:moss', reagents: ['buried', 'water'], products: ['moss'] },
      { key: 'germinate:sprout', reagents: ['buried'], products: ['sprout'] },
      { key: 'raise:sprout', reagents: ['sprout'], products: ['tip', 'stalk'] },
      { key: 'bloom:tip', reagents: ['tip'], products: ['flower'] },
    ])
    // The climb, petal shedding, evaporation and the dirt refund are not
    // entries (ticket 07's NOT list), so nothing else is declared.
    expect(graph.hooks).toHaveLength(4)
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
