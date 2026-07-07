import { Handler, ValidationError, type AppContext } from '@hoe/backend-kit'
import { PRESET_DEFINITIONS } from '@hoe/sprout-shared'
import { z } from 'zod'

import type { PasswordHasher } from '../../password.ts'
import type { SproutStore } from '../../store.ts'
import { requireParent } from '../authz.ts'
import { calibrationAnswerSchema, presetNameSchema, slidersSchema } from './schemas.ts'

export const createChildInputSchema = z.object({
  displayName: z.string().min(1),
  presetName: presetNameSchema,
  pin: z.string(),
  sliderOverrides: slidersSchema.partial().optional(),
  calibrationAnswers: z.array(calibrationAnswerSchema).optional(),
})
export type CreateChildInput = z.infer<typeof createChildInputSchema>

export interface CreateChildResult {
  child: { id: string; username: string; displayName: string }
}

// Server-side backstop for the 4-digit PIN the onboarding UI enforces. Prevents
// an empty/garbage PIN being hashed and stored as a valid credential.
const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin)

const defaultGenerateUsername = (displayName: string): string => {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10)
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${base}${suffix}`
}

export interface CreateChildDeps {
  /** Injected at the composition root (scrypt in Node, a fake in `.iwft`). */
  hasher: PasswordHasher
  /** Injected for deterministic tests (fridge's `idGen` pattern). */
  generateUsername?: (displayName: string) => string
}

/**
 * children.create — provisions a child under the authenticated parent: the
 * child row (temp password = username, `mustChangePassword` set), its preset
 * row (preset defaults + any overrides), and any calibration answers.
 * `parentId` comes from `ctx.auth`, never input.
 */
export class CreateChildHandler extends Handler<CreateChildInput, CreateChildResult, SproutStore> {
  private readonly hasher: PasswordHasher
  private readonly generateUsername: (displayName: string) => string

  constructor(deps: CreateChildDeps) {
    super()
    this.hasher = deps.hasher
    this.generateUsername = deps.generateUsername ?? defaultGenerateUsername
  }

  async run(input: CreateChildInput, ctx: AppContext<SproutStore>): Promise<CreateChildResult> {
    const parent = requireParent(ctx)
    if (!isValidPin(input.pin)) {
      throw new ValidationError('PIN must be exactly 4 digits.')
    }

    const username = this.generateUsername(input.displayName)
    const child = await ctx.store.createChild({
      parentId: parent.id,
      displayName: input.displayName,
      username,
      // The child's initial password is its username — a weak default the child
      // is forced to change on first login (mustChangePassword defaults true).
      passwordHash: this.hasher.hash(username),
      pinHash: this.hasher.hash(input.pin),
      presetName: input.presetName,
    })

    const defaults = PRESET_DEFINITIONS[input.presetName].sliders
    await ctx.store.createPreset({
      childId: child.id,
      name: input.presetName,
      ...defaults,
      ...input.sliderOverrides,
    })

    if (input.calibrationAnswers && input.calibrationAnswers.length > 0) {
      await ctx.store.createCalibrationAnswers(child.id, input.calibrationAnswers)
    }

    return { child: { id: child.id, username, displayName: child.displayName } }
  }
}
