import type { MintFamilyTokenInput, MintFamilyTokenOpts } from '../familyToken.ts'
import { mintFamilyToken } from '../familyToken.ts'

import { TEST_FAMILY_PRIVATE_KEY } from './testKeys.ts'

export function mintTestToken(input: MintFamilyTokenInput, opts: MintFamilyTokenOpts = {}): string {
  return mintFamilyToken(input, TEST_FAMILY_PRIVATE_KEY, opts)
}
