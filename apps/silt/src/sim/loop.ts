/**
 * Fixed-timestep driver (spec §5.3). The `clock` double-update guard ties
 * correctness to sim ticks, so the tick rate must not follow the display's —
 * this is a requirement, not a nicety. The renderer feeds elapsed milliseconds
 * in; how many ticks that buys is this class's business.
 *
 * Headless by design: no rAF, no DOM. The renderer owns the frame source.
 */
export class FixedTimestep {
  readonly stepMs: number
  readonly maxStepsPerAdvance: number
  #accumulated = 0

  constructor(stepMs: number, maxStepsPerAdvance = 8) {
    this.stepMs = stepMs
    this.maxStepsPerAdvance = maxStepsPerAdvance
  }

  /**
   * Run whole steps for the elapsed time, keeping the remainder. A long stall
   * (backgrounded tab, breakpoint) is capped and the debt dropped rather than
   * repaid — catching up would only stall harder.
   */
  advance(elapsedMs: number, onStep: () => void): number {
    this.#accumulated += elapsedMs
    let steps = 0
    while (this.#accumulated >= this.stepMs) {
      if (steps === this.maxStepsPerAdvance) {
        this.#accumulated = 0
        break
      }
      this.#accumulated -= this.stepMs
      steps++
      onStep()
    }
    return steps
  }

  reset(): void {
    this.#accumulated = 0
  }
}
