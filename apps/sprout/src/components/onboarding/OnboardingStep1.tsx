// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import type { FormEvent } from 'react'
import { useState } from 'react'

import { PRESET_LIST, type PresetName } from '../../server/domain/presets.ts'
import { Button } from '../ui/button.tsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx'
import { Input } from '../ui/input.tsx'
import { Label } from '../ui/label.tsx'
import type { OnboardingData } from './types.ts'

interface OnboardingStep1Props {
  data: OnboardingData
  onNext: (data: Partial<OnboardingData>) => void
}

export function OnboardingStep1({ data, onNext }: OnboardingStep1Props) {
  const [displayName, setDisplayName] = useState(data.displayName)
  const [selectedPreset, setSelectedPreset] = useState<PresetName>(data.presetName)
  const [pin, setPin] = useState(data.pin)
  const [error, setError] = useState('')

  const handleNext = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!displayName.trim()) {
      setError("Please enter your child's name.")
      return
    }
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }

    onNext({ displayName: displayName.trim(), presetName: selectedPreset, pin })
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Add a child</CardTitle>
        <CardDescription>Give them a name, pick a starting preset, and set a PIN.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleNext} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Child&apos;s name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="e.g. Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Preset</Label>
            <div className="grid gap-2">
              {PRESET_LIST.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => setSelectedPreset(preset.name)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    selectedPreset === preset.name
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium">{preset.label}</p>
                  <p className="text-muted-foreground text-sm">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pin">4-digit PIN</Label>
            <Input
              id="pin"
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              placeholder="e.g. 1234"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              required
            />
            <p className="text-muted-foreground text-xs">
              Your child will use this PIN to log in on shared devices.
            </p>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <Button type="submit" size="lg">
            Next
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
