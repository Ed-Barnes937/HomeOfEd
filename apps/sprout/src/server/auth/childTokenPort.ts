// The child-token minting PORT (plan §5.2). This is the DI seam that keeps
// `node:crypto` out of the browser `.iwft` bundle — the exact mirror of the
// `PasswordHasher` port in password.ts. Handlers depend on this type (erased,
// browser-safe); the composition root injects the concrete Node minter
// (auth/childToken.ts `mintChildToken`, which closes over the dedicated
// CHILD_SESSION_SECRET) or a fake string minter (the `.iwft` harness).
//
// This file MUST NOT import node:crypto (directly or transitively) — that is
// the whole point of the seam.

/** Mints a signed child-session token from the child's proven identity. */
export type ChildTokenMinter = (claims: { childId: string; parentId: string }) => string
