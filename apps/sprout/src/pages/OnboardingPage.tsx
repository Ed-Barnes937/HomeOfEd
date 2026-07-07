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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{result.displayName}&apos;s account is ready!</CardTitle>
            <CardDescription>Here are the details you&apos;ll need.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Username</span>
                <span className="font-mono font-bold">{result.username}</span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Password</span>
                <span className="font-mono font-bold">{result.username}</span>
              </div>
            </div>
            <p className="text-muted-foreground text-center text-sm">
              On a new device, your child logs in with their username and password. On a shared
              family device, they just pick their name and enter their PIN.
            </p>
            <Button className="w-full" size="lg" onClick={() => void navigate({ to: '/parent/dashboard' })}>
              Go to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
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
          {error && <p className="text-destructive mt-2 text-center text-sm">{error}</p>}
        </>
      )}
    </div>
  )
}
