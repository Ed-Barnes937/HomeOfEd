// Ported from the source `routes/parent/onboarding.tsx`. `children.create`
// derives parentId from `ctx.auth`, so the wizard no longer sends a parentId.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { OnboardingStep1 } from '../components/onboarding/OnboardingStep1.tsx'
import { OnboardingStep2 } from '../components/onboarding/OnboardingStep2.tsx'
import { OnboardingStep3 } from '../components/onboarding/OnboardingStep3.tsx'
import { INITIAL_ONBOARDING_DATA, type OnboardingData } from '../components/onboarding/types.ts'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { createChild } from '../features/children/childrenQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import styles from './OnboardingPage.module.scss'

export function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const session = useRequireParent()
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>(INITIAL_ONBOARDING_DATA)
  const [error, setError] = useState('')

  const createChildMutation = useMutation({
    mutationFn: createChild,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['children'] }),
    onError: () => setError('Failed to create child account. Please try again.'),
  })
  const result = createChildMutation.data?.child ?? null

  if (session.isPending) {
    return (
      <div className={styles.loading}>
        <p className={styles.loadingText}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  const updateData = (partial: Partial<OnboardingData>) => setData((prev) => ({ ...prev, ...partial }))

  const handleSubmit = () => {
    setError('')
    createChildMutation.mutate({
      displayName: data.displayName,
      presetName: data.presetName,
      pin: data.pin,
      sliderOverrides:
        Object.keys(data.sliderOverrides).length > 0 ? data.sliderOverrides : undefined,
      calibrationAnswers:
        data.calibrationAnswers.length > 0 ? data.calibrationAnswers : undefined,
    })
  }

  if (result) {
    return (
      <div className={styles.resultWrap}>
        <Card className={styles.card}>
          <CardHeader className={styles.headerCenter}>
            <CardTitle className={styles.title}>{result.displayName}&apos;s account is ready!</CardTitle>
            <CardDescription>Here are the details you&apos;ll need.</CardDescription>
          </CardHeader>
          <CardContent className={styles.content}>
            <div className={styles.detailBox}>
              <div className={styles.detailRow}>
                <span className={styles.muted}>Username</span>
                <span className={styles.monoBold}>{result.username}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.muted}>Password</span>
                <span className={styles.monoBold}>{result.username}</span>
              </div>
            </div>
            <p className={styles.note}>
              On a new device, your child logs in with their username and password. On a shared
              family device, they just pick their name and enter their PIN.
            </p>
            <Button className={styles.fullButton} size="lg" onClick={() => void navigate({ to: '/parent/dashboard' })}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.wizardWrap}>
      {step === 0 && (
        <OnboardingStep1
          data={data}
          onNext={(partial) => {
            updateData(partial)
            setStep(1)
          }}
        />
      )}

      {step === 1 && (
        <OnboardingStep2
          data={data}
          onNext={(partial) => {
            updateData(partial)
            setStep(2)
          }}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && (
        <>
          <OnboardingStep3
            data={data}
            onSubmit={handleSubmit}
            onBack={() => setStep(1)}
            onEdit={(targetStep) => setStep(targetStep)}
            onSliderChange={(overrides) => updateData({ sliderOverrides: overrides })}
            isSubmitting={createChildMutation.isPending}
          />
          {error && <p className={styles.errorText}>{error}</p>}
        </>
      )}
    </div>
  )
}
