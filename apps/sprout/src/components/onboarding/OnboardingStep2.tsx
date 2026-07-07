// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { CALIBRATION_QUESTIONS, type CalibrationAnswer } from '@hoe/sprout-shared'
import { useState } from 'react'

import { cn } from '../../lib/utils.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'
import { Textarea } from '../ui/textarea.tsx'
import styles from './OnboardingStep2.module.scss'
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
    <Card className={styles.card}>
      <CardHeader className={styles.headerCenter}>
        <CardTitle className={styles.title}>Sensitive topic calibration</CardTitle>
        <CardDescription>
          How should the AI handle tricky questions? Pick the answer style that feels right for your
          child.
        </CardDescription>
        <p className={styles.questionCount}>
          Question {currentQuestion + 1} of {CALIBRATION_QUESTIONS.length}
        </p>
      </CardHeader>
      <CardContent className={styles.content}>
        <div className={styles.questionBlock}>
          <p className={styles.questionText}>&ldquo;{question.question}&rdquo;</p>
          <p className={styles.questionContext}>{question.context}</p>
        </div>

        <div className={styles.options}>
          {question.options.map((option) => (
            <button
              key={option.level}
              type="button"
              onClick={() => updateState(question.id, { selectedLevel: option.level, showCustom: false })}
              className={cn(
                styles.optionButton,
                state.selectedLevel === option.level && !state.showCustom
                  ? styles.optionButtonSelected
                  : styles.optionButtonUnselected,
              )}
            >
              {option.text}
            </button>
          ))}

          {!state.showCustom ? (
            <button
              type="button"
              onClick={() => updateState(question.id, { showCustom: true, selectedLevel: null })}
              className={styles.customButton}
            >
              Write your own answer...
            </button>
          ) : (
            <div className={styles.customWrap}>
              <Textarea
                placeholder="Write how you'd like the AI to respond..."
                value={state.customAnswer}
                onChange={(e) => updateState(question.id, { customAnswer: e.target.value })}
                rows={3}
              />
              <button
                type="button"
                onClick={() => updateState(question.id, { showCustom: false, customAnswer: '' })}
                className={styles.cancelCustom}
              >
                Cancel custom answer
              </button>
            </div>
          )}
        </div>

        <div className={styles.nav}>
          {currentQuestion > 0 ? (
            <Button
              type="button"
              variant="outline"
              className={styles.flex1}
              onClick={() => setCurrentQuestion((prev) => prev - 1)}
            >
              Previous
            </Button>
          ) : (
            <Button type="button" variant="outline" className={styles.flex1} onClick={onBack}>
              Back
            </Button>
          )}
          <Button type="button" className={styles.flex1} onClick={handleNextQuestion} disabled={!hasAnswer}>
            {isLast ? 'Next' : 'Next question'}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => onNext({ calibrationAnswers: [] })}
          className={styles.skip}
        >
          Skip calibration — use defaults
        </button>
      </CardContent>
    </Card>
  )
}
