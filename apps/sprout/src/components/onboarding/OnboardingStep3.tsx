// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import { useState } from 'react'

import {
  CALIBRATION_QUESTIONS,
  PRESET_DEFINITIONS,
  SLIDER_LABELS,
  type PresetSliders,
} from '@hoe/sprout-shared'

import { SLIDER_KEYS } from '../../server/domain/presets.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'
import { Slider } from '../ui/slider.tsx'
import styles from './OnboardingStep3.module.scss'
import type { OnboardingData } from './types.ts'

interface OnboardingStep3Props {
  data: OnboardingData
  onSubmit: () => void
  onBack: () => void
  onEdit: (step: number) => void
  onSliderChange: (overrides: Partial<PresetSliders>) => void
  isSubmitting: boolean
}

export function OnboardingStep3({
  data,
  onSubmit,
  onBack,
  onEdit,
  onSliderChange,
  isSubmitting,
}: OnboardingStep3Props) {
  const [showSliders, setShowSliders] = useState(false)
  const preset = PRESET_DEFINITIONS[data.presetName]
  const effectiveSliders = { ...preset.sliders, ...data.sliderOverrides }
  const hasCalibration = data.calibrationAnswers.length > 0

  const handleSliderValueChange = (key: keyof PresetSliders, value: number) => {
    const presetDefault = preset.sliders[key]
    const currentOverrides = { ...data.sliderOverrides }
    if (value === presetDefault) {
      delete currentOverrides[key]
    } else {
      currentOverrides[key] = value
    }
    onSliderChange(currentOverrides)
  }

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.headerCenter}>
        <CardTitle className={styles.title}>Review &amp; confirm</CardTitle>
        <CardDescription>
          Check everything looks right before creating {data.displayName}&apos;s account.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        <div className={styles.reviewRow}>
          <div>
            <p className={styles.reviewLabel}>Name</p>
            <p className={styles.reviewValue}>{data.displayName}</p>
          </div>
          <button type="button" onClick={() => onEdit(0)} className={styles.editButton}>
            Edit
          </button>
        </div>

        <div className={styles.reviewRow}>
          <div>
            <p className={styles.reviewLabel}>Preset</p>
            <p className={styles.reviewValue}>{preset.label}</p>
          </div>
          <button type="button" onClick={() => onEdit(0)} className={styles.editButton}>
            Edit
          </button>
        </div>

        <div className={styles.reviewRow}>
          <div>
            <p className={styles.reviewLabel}>PIN</p>
            <p className={styles.reviewValueMono}>{'*'.repeat(data.pin.length)}</p>
          </div>
          <button type="button" onClick={() => onEdit(0)} className={styles.editButton}>
            Edit
          </button>
        </div>

        <div className={styles.reviewRow}>
          <div>
            <p className={styles.reviewLabel}>Sensitive topic calibration</p>
            <p className={styles.reviewValue}>
              {hasCalibration
                ? `${data.calibrationAnswers.length} of ${CALIBRATION_QUESTIONS.length} questions answered`
                : 'Skipped — using defaults'}
            </p>
          </div>
          <button type="button" onClick={() => onEdit(1)} className={styles.editButton}>
            Edit
          </button>
        </div>

        <div className={styles.sliderPanel}>
          <button
            type="button"
            onClick={() => setShowSliders(!showSliders)}
            className={styles.sliderToggle}
          >
            <span className={styles.sliderToggleLabel}>Customise guardrail sliders</span>
            <span className={styles.sliderToggleState}>{showSliders ? 'Hide' : 'Show'}</span>
          </button>

          {showSliders && (
            <div className={styles.sliderList}>
              {SLIDER_KEYS.map((key) => {
                const meta = SLIDER_LABELS[key]
                const value = effectiveSliders[key]
                return (
                  <div key={key} className={styles.sliderItem}>
                    <div className={styles.sliderHeader}>
                      <label className={styles.sliderLabel}>{meta.label}</label>
                      <span className={styles.sliderValue}>{value} / 5</span>
                    </div>
                    <Slider
                      min={1}
                      max={5}
                      step={1}
                      value={[value]}
                      onValueChange={(newValue) => handleSliderValueChange(key, newValue)}
                    />
                    <div className={styles.sliderScale}>
                      <span>{meta.low}</span>
                      <span>{meta.high}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className={styles.nav}>
          <Button type="button" variant="outline" className={styles.flex1} onClick={onBack}>
            Back
          </Button>
          <Button type="button" className={styles.flex1} onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : `Create ${data.displayName}'s account`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
