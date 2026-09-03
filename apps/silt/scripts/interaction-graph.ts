// Rewrites `docs/interaction-graph.md` from the live registry. Run it whenever
// an element or a reaction row changes; `src/docs/interactionGraph.test.ts`
// fails the suite if the checked-in file has drifted.
//
// Runs under `node --experimental-strip-types`, like `bench/sim.bench.ts`, so it
// sticks to erasable TS syntax (ADR 0004).
import { writeFileSync } from 'node:fs'

import { GRAPH_DOC_PATH, renderInteractionGraph } from '../src/docs/interactionGraph.ts'

const target = new URL('../docs/interaction-graph.md', import.meta.url)

writeFileSync(target, renderInteractionGraph(), 'utf8')

console.log(`wrote ${GRAPH_DOC_PATH}`)
