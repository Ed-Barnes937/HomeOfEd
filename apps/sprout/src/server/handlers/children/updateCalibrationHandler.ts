import { Handler, type AppContext } from '@hoe/backend-kit'
import { z } from 'zod'

import type { CalibrationAnswer } from '../../domain/calibration.ts'
import type { SproutStore } from '../../store.ts'
import { verifyChildOwnership } from '../authz.ts'
import { calibrationAnswerSchema } from './schemas.ts'

export const updateCalibrationInputSchema = z.object({
  childId: z.string().uuid(),
  answers: z.array(calibrationAnswerSchema),
})
export type UpdateCalibrationInput = z.infer<typeof updateCalibrationInputSchema>

export interface UpdateCalibrationResult {
  calibrationAnswers: CalibrationAnswer[]
}

/**
 * children.calibration — replace a child's calibration answer set wholesale.
 * The Store does the delete-then-insert atomically; we return the resulting set.
 */
export class UpdateCalibrationHandler extends Handler<
  UpdateCalibrationInput,
  UpdateCalibrationResult,
  SproutStore
> {
  async run(
    input: UpdateCalibrationInput,
    ctx: AppContext<SproutStore>,
  ): Promise<UpdateCalibrationResult> {
    const { child } = await verifyChildOwnership(ctx, input.childId)

    const rows = await ctx.store.replaceCalibrationAnswers(child.id, input.answers)
    return {
      calibrationAnswers: rows.map((a) => ({
        questionId: a.questionId,
        selectedLevel: a.selectedLevel,
        customAnswer: a.customAnswer,
      })),
    }
  }
}
