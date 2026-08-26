// The worker entry — deliberately nothing but glue, so every behaviour lives
// in the vitest-covered `SimWorkerCore`. The first message carries the shared
// buffers; after that the interval ticks and messages mutate. The worker
// never posts back: the page reads the world through the shared memory.
import { MS_PER_TICK } from '../../sim/index.ts'
import type { SimWorkerInit, SimWorkerMessage } from './simProtocol.ts'
import { SimWorkerCore } from './simWorkerCore.ts'

let core: SimWorkerCore | null = null

self.onmessage = (event: MessageEvent<SimWorkerInit | SimWorkerMessage>) => {
  const message = event.data
  if (message.type === 'init') {
    core = new SimWorkerCore(message.world)
    setInterval(() => core?.advance(performance.now()), MS_PER_TICK)
    return
  }
  core?.handle(message)
}
