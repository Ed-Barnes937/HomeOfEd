// The worker entry — deliberately nothing but glue, so every behaviour lives
// in the vitest-covered `SimWorkerCore`. The first message carries the shared
// buffers; after that the interval ticks and messages mutate. The world never
// travels: the page reads it through the shared memory, and the only thing
// posted back is a first witness, which is far too rare to poll for
// (discovery-tree spec §4).
import { MS_PER_TICK } from '../../sim/index.ts'
import type { SimPageMessage, SimWorkerInit, SimWorkerMessage } from './simProtocol.ts'
import { SimWorkerCore } from './simWorkerCore.ts'

let core: SimWorkerCore | null = null

self.onmessage = (event: MessageEvent<SimWorkerInit | SimWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    core = new SimWorkerCore(message.world, {
      report: (reply: SimPageMessage) => self.postMessage(reply),
    })
    setInterval(() => core?.advance(performance.now()), MS_PER_TICK)
    return
  }
  core?.handle(message)
}
