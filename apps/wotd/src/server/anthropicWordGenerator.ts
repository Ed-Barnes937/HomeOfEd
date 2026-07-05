import type { GeneratedWord, WordGenerator } from './wordGenerator.ts'

export interface AnthropicWordGeneratorOptions {
  apiKey?: string
  model?: string
}

/**
 * STUB pinned in step 3 (main.ts wires it as the prod generator). The backend
 * lane implements the real Anthropic tool-use call + response→GeneratedWord[]
 * parse/validation (throw-on-partial-set) in step 5. Construct the Anthropic
 * client lazily inside generateDailyWords so a missing key never crashes boot —
 * only /wotd generation fails.
 */
export class AnthropicWordGenerator implements WordGenerator {
  constructor(private readonly options: AnthropicWordGeneratorOptions) {}

  generateDailyWords(): Promise<GeneratedWord[]> {
    void this.options
    return Promise.reject(new Error('AnthropicWordGenerator.generateDailyWords not implemented'))
  }
}
