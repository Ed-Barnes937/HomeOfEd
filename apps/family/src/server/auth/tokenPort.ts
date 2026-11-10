// The minter as the router and handlers see it. A function, not `@hoe/accounts/
// server` itself, so the .iwft bundle can inject its own: minting is node:crypto.
import type { MintFamilyTokenInput } from '@hoe/accounts/server'

export type FamilyTokenMinter = (input: MintFamilyTokenInput) => string
