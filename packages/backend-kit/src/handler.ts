import type { AppContext } from './context.ts'

/**
 * Domain layer: route-handler classes hold the business logic and depend on
 * AppContext (interfaces) only — never a concrete DB/blob impl. The same
 * handler runs in production and in the simulator.
 */
export abstract class Handler<Input, Output, Store> {
  abstract run(input: Input, ctx: AppContext<Store>): Promise<Output>
}
