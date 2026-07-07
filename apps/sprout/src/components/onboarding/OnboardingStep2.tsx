// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { useState } from 'react'

import { CALIBRATION_QUESTIONS, type CalibrationAnswer } from '../../server/domain/calibration.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'
import { Textarea } from '../ui/textarea.tsx'
import type { OnboardingData } from './types.ts'

interface OnboardingStep2Props {
  data: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

interface QuestionState {
  selectedLevel: number | null
  customAnswer: string
  showCustom: boolean
}

export function OnboardingStep2({ data, onNext, onBack }: OnboardingStep2Props) {
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [questionStates, setQuestionStates] = useState<Record<string, QuestionState>>(() => {
    const initial: Record<string, QuestionState> = {}
    for (const q of CALIBRATION_QUESTIONS) {
      const existing = data.calibrationAnswers.find((a) => a.questionId === q.id)
      initial[q.id] = {
        selectedLevel: existing?.selectedLevel ?? null,
        customAnswer: existing?.customAnswer ?? '',
        showCustom: existing?.customAnswer != null && existing.customAnswer !== '',
      }
    }
    return initial
  })

  const question = CALIBRATION_QUESTIONS[currentQuestion]
  const state = question ? questionStates[question.id] : undefined
  const isLast = currentQuestion === CALIBRATION_QUESTIONS.length - 1

  const updateState = (questionId: string, update: Partial<QuestionState>) => {
    setQuestionStates((prev) => {
      const base: QuestionState = prev[questionId] ?? {
        selectedLevel: null,
        customAnswer: '',
        showCustom: false,
      }
      return { ...prev, [questionId]: { ...base, ...update } }
    })
  }

  const buildAnswers = (): CalibrationAnswer[] => {
    const answers: CalibrationAnswer[] = []
    for (const q of CALIBRATION_QUESTIONS) {
      const s = questionStates[q.id]
      if (!s) continue
      if (s.showCustom && s.customAnswer.trim()) {
        answers.push({ questionId: q.id, selectedLevel: null, customAnswer: s.customAnswer.trim() })
      } else if (s.selectedLevel !== null) {
        answers.push({ questionId: q.id, selectedLevel: s.selectedLevel, customAnswer: null })
      }
    }
    return answers
  }

  const handleNextQuestion = () => {
    if (isLast) {
      onNext({ calibrationAnswers: buildAnswers() })
    } else {
      setCurrentQuestion((prev) => prev + 1)
    }
  }

  if (!question || !state) return null

  const hasAnswer =
    state.selectedLevel !== null || (state.showCustom && state.customAnswer.trim() !== '')

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Sensitive topic calibration</CardTitle>
        <CardDescription>
          How should the AI handle tricky questions? Pick the answer style that feels right for your
          child.
        </CardDescription>
        <p className="text-muted-foreground mt-1 text-sm">
          Question {currentQuestion + 1} of {CALIBRATION_QUESTIONS.length}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">&ldquo;{question.question}&rdquo;</p>
          <p className="text-muted-foreground text-sm">{question.context}</p>
        </div>

        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <button
              key={option.level}
              type="button"
              onClick={() => updateState(question.id, { selectedLevel: option.level, showCustom: false })}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                state.selectedLevel === option.level && !state.showCustom
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              {option.text}
            </button>
          ))}

          {!state.showCustom ? (
            <button
              type="button"
              onClick={() => updateState(question.id, { showCustom: true, selectedLevel: null })}
              className="border-border hover:border-primary/50 rounded-lg border border-dashed p-3 text-left text-sm transition-colors"
            >
              Write your own answer...
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Textarea
                placeholder="Write how you'd like the AI to respond..."
                value={state.customAnswer}
                onChange={(e) => updateState(question.id, { customAnswer: e.target.value })}
                rows={3}
              />
              <button
                type="button"
                onClick={() => updateState(question.id, { showCustom: false, customAnswer: '' })}
                className="text-muted-foreground text-left text-xs underline"
              >
                Cancel custom answer
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {currentQuestion > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setCurrentQuestion((prev) => prev - 1)}
            >
              Previous
            </Button>
          ) : (
            <Button type="button" variant="outline" className="flex-1" onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={handleNextQuestion} disabled={!hasAnswer}>
            {isLast ? 'Next' : 'Next question'}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => onNext({ calibrationAnswers: [] })}
          className="text-muted-foreground text-center text-sm underline"
        >
          Skip calibration — use defaults
        </button>
      </CardContent>
    </Card>
  )
}
