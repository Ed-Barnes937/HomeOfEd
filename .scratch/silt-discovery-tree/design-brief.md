# Field notes - design brief for claude-design

Mockups for a discovery-tree feature in **silt**, a falling-sand playground at
silt.homeofed.com. Everything you need is in this one file plus the two
screenshots beside it (`handoff/silt-desktop.png`, `handoff/silt-mobile.png`).
The engineering spec is `spec.md` in this directory; you should not need it.

## The feature in one paragraph

Silt is a quiet sandbox: paint elements, watch them fall, flow, burn and react.
We are adding a collection layer called **Field notes**: the app tracks which
elements and which interactions the player has personally witnessed, and shows
that progress as a graph of pixel-styled element tiles with the connections
between them lighting up as they are discovered. Tone: a naturalist's journal
being filled in, not an achievement system. Calm, warm, a little austere -
match the app in the screenshots (cream chrome, uppercase lettering, dark
canvas, chunky pixel world).

## What we need mocked

1. **The header entry control** - lives in the existing top bar (see
   screenshots, next to SCENES): the words "Field notes" plus a progress
   readout (e.g. `21/37`). States: untouched (fresh install), mid-progress,
   complete, and the brief moment it ticks up.
2. **The Field notes panel, desktop** - an overlay over the canvas (the
   SCENES popover is the existing precedent for chrome-over-canvas). Contains
   the full graph plus the two counters (elements `12/19`, interactions
   `21/37`).
3. **The Field notes sheet, mobile** - full-screen takeover (see the mobile
   screenshot for the app's mobile chrome: bottom rail, status strip).
4. **The node + edge visual language** - the heart of the job, all states
   below.
5. **The discovery notification** - a small, quiet moment when something is
   witnessed for the first time (e.g. "new entry: obsidian"). No confetti.
6. **The 100% moment** - small and one-time; the finished chart itself is the
   reward. No persistent cosmetic afterwards.
7. **The empty state** - first launch: the 11 rail elements are already
   "known", nothing else is; the panel should invite experimentation.

## Node and edge states (the mockups must show all of these)

Nodes (pixel-art square tiles, named):
- **Pre-known** - the 11 paintable elements, known from first launch.
- **Discovered** - a product the player has created. Tile uses the element's
  exact `hex` from the data below (these are the real in-game colours; do not
  restyle them).
- **Undiscovered** - silhouette policy: a darkened "?" tile. Its position and
  existence are visible; its identity is not.

Edges (three kinds, each visually distinct):
- **Reaction** - two reagents meet (e.g. water + lava). The most common kind.
- **Decay** - one element becomes another over time (fire to smoke, steam to
  water, ember to fire).
- **Growth** - a plant consumes adjacent water to grow (moss/vine + water
  makes vine).

Edge states:
- **Witnessed** - lit, labelled with its products.
- **Unwitnessed, visible** - shown faint/dashed with no product label, only
  when at least one endpoint is discovered or pre-known.
- **Hidden** - both endpoints undiscovered.

## Layout facts (the real problem to solve)

- 19 nodes. Tier 0: the 11 paintables, ideally in rail order (dirt, sand,
  water, lava, wood, oil, fire, acid, stone, mud, seed - see the rail in the
  desktop screenshot). Tier 1: obsidian, smoke, steam, sulphur, moss, ember.
  Tier 2: vine, ash.
- 37 edges, and it is a graph, not a tree: there are cycles (water to steam
  and back; wood chars to ember and a douse turns it back to wood). Fire is a
  hub with ~11 connections; several elements pair with acid only to be
  consumed (no product) - an edge can have zero, one or two products.
- The panel must stay legible at both desktop-overlay and phone-sheet sizes;
  it may scroll/pan if needed, but the counters stay visible.

## Hard constraints

- Element tiles use the exact `hex` values in the data - the rail, the canvas
  and Field notes must read as one palette.
- Pixel-art tiles; type and chrome consistent with the screenshots.
- Silhouette spoiler policy exactly as stated above.
- Quiet: no badges, no confetti, no persistent completion cosmetic.
- The roster will grow (it went 17 to 19 elements while this brief was being
  written) - the layout system must be one where a new node and its edges
  slot in without redesign.

## The graph data (real, generated from the game's registry)

`tier` is minimum transmutation depth from the paintables. `archetype` is how
the element behaves (static / powder / liquid / gas). `products` is what an
edge produces; an empty list means both sides are consumed.

```json
{
  "counts": {"elements":19,"paintable":11,"discoverable":8,"interactions":37,"reactions":32,"decays":3,"growth":2},
  "nodes": [
    {"name":"dirt","hex":"#8a7358","archetype":"static","tags":["solid"],"paintable":true,"tier":0},
    {"name":"sand","hex":"#d9b978","archetype":"powder","tags":["powder"],"paintable":true,"tier":0},
    {"name":"water","hex":"#6f9fc4","archetype":"liquid","tags":["liquid"],"paintable":true,"tier":0},
    {"name":"lava","hex":"#d4622a","archetype":"liquid","tags":["liquid"],"paintable":true,"tier":0},
    {"name":"obsidian","hex":"#2a2430","archetype":"static","tags":["solid"],"paintable":false,"tier":1},
    {"name":"wood","hex":"#6b4a2a","archetype":"static","tags":["solid","flammable"],"paintable":true,"tier":0},
    {"name":"oil","hex":"#46402c","archetype":"liquid","tags":["liquid","flammable"],"paintable":true,"tier":0},
    {"name":"fire","hex":"#ef7d1a","archetype":"gas","tags":["gas","energy"],"paintable":true,"tier":0},
    {"name":"smoke","hex":"#6b6660","archetype":"gas","tags":["gas"],"paintable":false,"tier":1},
    {"name":"steam","hex":"#cfd6da","archetype":"gas","tags":["gas"],"paintable":false,"tier":1},
    {"name":"acid","hex":"#8fd128","archetype":"liquid","tags":["liquid"],"paintable":true,"tier":0},
    {"name":"stone","hex":"#6f6a63","archetype":"static","tags":["solid"],"paintable":true,"tier":0},
    {"name":"sulphur","hex":"#d6c53c","archetype":"powder","tags":["powder","flammable"],"paintable":false,"tier":1},
    {"name":"mud","hex":"#5b4632","archetype":"liquid","tags":["liquid"],"paintable":true,"tier":0},
    {"name":"seed","hex":"#9c8348","archetype":"powder","tags":["powder","flammable"],"paintable":true,"tier":0},
    {"name":"moss","hex":"#4a7a34","archetype":"static","tags":["solid","flammable"],"paintable":false,"tier":1},
    {"name":"vine","hex":"#79b74a","archetype":"static","tags":["solid","flammable"],"paintable":false,"tier":2},
    {"name":"ember","hex":"#b3401d","archetype":"static","tags":["solid"],"paintable":false,"tier":1},
    {"name":"ash","hex":"#9b948b","archetype":"powder","tags":["powder"],"paintable":false,"tier":2}
  ],
  "edges": [
    {"kind":"reaction","between":["dirt","water"],"products":["mud"]},
    {"kind":"reaction","between":["dirt","acid"],"products":[]},
    {"kind":"reaction","between":["sand","acid"],"products":[]},
    {"kind":"reaction","between":["water","lava"],"products":["steam","obsidian"]},
    {"kind":"reaction","between":["water","fire"],"products":["steam","smoke"]},
    {"kind":"reaction","between":["water","acid"],"products":["water","water"]},
    {"kind":"reaction","between":["water","ember"],"products":["steam","wood"]},
    {"kind":"reaction","between":["water","ash"],"products":["mud"]},
    {"kind":"reaction","between":["lava","wood"],"products":["lava","ember"]},
    {"kind":"reaction","between":["lava","oil"],"products":["lava","fire"]},
    {"kind":"reaction","between":["lava","acid"],"products":["lava","smoke"]},
    {"kind":"reaction","between":["lava","sulphur"],"products":["lava","fire"]},
    {"kind":"reaction","between":["lava","mud"],"products":["lava","stone"]},
    {"kind":"reaction","between":["lava","seed"],"products":["lava","fire"]},
    {"kind":"reaction","between":["lava","moss"],"products":["lava","fire"]},
    {"kind":"reaction","between":["lava","vine"],"products":["lava","fire"]},
    {"kind":"reaction","between":["wood","fire"],"products":["ember","fire"]},
    {"kind":"reaction","between":["wood","acid"],"products":["sulphur"]},
    {"kind":"reaction","between":["wood","ember"],"products":["ember","ember"]},
    {"kind":"reaction","between":["oil","fire"],"products":["fire","fire"]},
    {"kind":"reaction","between":["fire","sulphur"],"products":["fire","fire"]},
    {"kind":"reaction","between":["fire","mud"],"products":["smoke","dirt"]},
    {"kind":"reaction","between":["fire","seed"],"products":["fire","fire"]},
    {"kind":"reaction","between":["fire","moss"],"products":["fire","fire"]},
    {"kind":"reaction","between":["fire","vine"],"products":["fire","fire"]},
    {"kind":"reaction","between":["fire","ember"],"products":["fire","ash"]},
    {"kind":"reaction","between":["acid","seed"],"products":[]},
    {"kind":"reaction","between":["acid","moss"],"products":[]},
    {"kind":"reaction","between":["acid","vine"],"products":[]},
    {"kind":"reaction","between":["acid","ember"],"products":[]},
    {"kind":"reaction","between":["acid","ash"],"products":[]},
    {"kind":"reaction","between":["mud","seed"],"products":["mud","moss"]},
    {"kind":"decay","between":["fire"],"products":["smoke"]},
    {"kind":"decay","between":["steam"],"products":["water"]},
    {"kind":"decay","between":["ember"],"products":["fire"]},
    {"kind":"growth","between":["moss","water"],"products":["vine"]},
    {"kind":"growth","between":["vine","water"],"products":["vine"]}
  ]
}```

## Deliverables

Mockups (desktop overlay + mobile sheet + the states enumerated above) we can
implement in React/CSS inside the app - static images or HTML are both fine.
Any layout algorithm you imply must be deterministic and derivable from the
JSON above (tiers, rail order), since the roster keeps growing.
