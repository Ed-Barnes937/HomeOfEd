// Services the router injects into handlers at the composition root (plan §5.1).
// These are the dependencies that CANNOT come from `ctx` (the frozen
// AppContext<Store> seam): the password hasher (node:crypto, browser-unsafe),
// the child-token minter (node:crypto + the dedicated signing secret, also
// browser-unsafe) and the pipeline summariser (an HTTP call, stubbed until P5).
// The composition roots (main.ts / simulator.ts / IwftApp.tsx) build a
// `RouterDeps` and pass it to `createAppRouter`.
import type { ChildTokenMinter } from '../auth/childTokenPort.ts'
import type { PasswordHasher } from '../password.ts'

/**
 * Summarises a conversation via the pipeline (conversations.summariseAndPurge,
 * the retention worker). The real impl is an HTTP call over the private network
 * — DO NOT build it in P3 (plan §5.1). Composition roots pass a stub that
 * rejects; P5 wires the real pipeline client.
 */
export type Summariser = (messages: { role: string; content: string }[]) => Promise<string>

export interface RouterDeps {
  hasher: PasswordHasher
  summarise: Summariser
  /**
   * Mints a signed child-session token at child login (childAuth.loginPassword
   * / loginPin). The concrete Node impl closes over the dedicated
   * CHILD_SESSION_SECRET; the `.iwft` harness passes a browser-safe fake so
   * node:crypto never reaches the CT bundle.
   */
  mintChildToken: ChildTokenMinter
}
