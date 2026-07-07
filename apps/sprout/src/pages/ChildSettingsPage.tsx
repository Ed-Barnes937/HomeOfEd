// Ported from the source `routes/parent/children.$childId.tsx`.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link } from '@tanstack/react-router'
import { PRESET_DEFINITIONS, type PresetName, type PresetSliders } from '@hoe/sprout-shared'
import { useMemo, useState } from 'react'

import { InspireMeTopics } from '../components/dashboard/InspireMeTopics.tsx'
import { PresetSelector } from '../components/dashboard/PresetSelector.tsx'
import { SliderControls } from '../components/dashboard/SliderControls.tsx'
import { Button } from '../components/ui/button.tsx'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card.tsx'
import { Input } from '../components/ui/input.tsx'
import {
  childConfigQueryOptions,
  childrenQueryOptions,
  updateChild,
  updatePreset,
} from '../features/children/childrenQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import { addTopic, removeTopic, topicsQueryOptions } from '../features/topics/topicsQueries.ts'

const route = getRouteApi('/parent/children/$childId')

export function ChildSettingsPage() {
  const { childId } = route.useParams()
  const queryClient = useQueryClient()
  const session = useRequireParent()

  const { data: kids } = useQuery({ ...childrenQueryOptions, enabled: Boolean(session.data) })
  const { data: topics } = useQuery({
    ...topicsQueryOptions(childId),
    enabled: Boolean(session.data),
  })
  const { data: childConfig } = useQuery({
    ...childConfigQueryOptions(childId),
    enabled: Boolean(session.data),
  })

  const child = kids?.find((c) => c.id === childId)

  const [sliderOverrides, setSliderOverrides] = useState<Partial<PresetSliders>>({})
  const [showPinReset, setShowPinReset] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const [presetSaved, setPresetSaved] = useState(false)
  const [slidersSaved, setSlidersSaved] = useState(false)

  const invalidateChild = () => {
    void queryClient.invalidateQueries({ queryKey: ['children'] })
    void queryClient.invalidateQueries({ queryKey: ['child-config', childId] })
    void queryClient.invalidateQueries({ queryKey: ['child-stats', childId] })
  }

  const updateChildMutation = useMutation({
    mutationFn: updateChild,
    onSuccess: invalidateChild,
  })
  const updatePresetMutation = useMutation({
    mutationFn: updatePreset,
    onSuccess: invalidateChild,
  })
  const addTopicMutation = useMutation({
    mutationFn: (topic: string) => addTopic(childId, topic),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['topics', childId] }),
  })
  const removeTopicMutation = useMutation({
    mutationFn: (topicId: string) => removeTopic(childId, topicId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['topics', childId] }),
  })

  const sliderValues = useMemo<PresetSliders | null>(() => {
    if (!child) return null
    const preset = PRESET_DEFINITIONS[child.presetName]
    if (!preset) return null
    const base = childConfig?.sliders ?? preset.sliders
    return { ...base, ...sliderOverrides }
  }, [child, childConfig, sliderOverrides])

  if (session.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  if (!child) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-muted-foreground">Child not found.</p>
        <Link to="/parent/children" className="text-primary mt-2 inline-block text-sm underline">
          Back to children
        </Link>
      </div>
    )
  }

  const handlePresetChange = (presetName: PresetName) => {
    setPresetSaved(false)
    updateChildMutation.mutate(
      { childId, presetName },
      {
        onSuccess: () => {
          setSliderOverrides({})
          setPresetSaved(true)
        },
      },
    )
  }

  const handleSliderChange = (key: keyof PresetSliders, value: number) => {
    setSliderOverrides((prev) => ({ ...prev, [key]: value }))
    setSlidersSaved(false)
  }

  const handleSliderCommit = (key: keyof PresetSliders, value: number) => {
    if (!sliderValues) return
    updatePresetMutation.mutate(
      { childId, sliders: { ...sliderValues, [key]: value } },
      { onSuccess: () => setSlidersSaved(true) },
    )
  }

  const handlePinReset = () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return
    setPinSaved(false)
    updateChildMutation.mutate(
      { childId, pin: newPin },
      {
        onSuccess: () => {
          setNewPin('')
          setShowPinReset(false)
          setPinSaved(true)
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/parent/children"
        className="text-muted-foreground mb-4 inline-block text-sm underline"
      >
        Back to children
      </Link>

      <h1 className="text-2xl font-bold">{child.displayName}&apos;s Settings</h1>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preset</CardTitle>
          </CardHeader>
          <CardContent>
            <PresetSelector
              value={child.presetName}
              onChange={handlePresetChange}
              disabled={updateChildMutation.isPending}
            />
            {presetSaved && <p className="text-sm text-green-600 mt-2">Preset saved</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Guardrail Sliders</CardTitle>
          </CardHeader>
          <CardContent>
            {sliderValues ? (
              <>
                <SliderControls
                  values={sliderValues}
                  onChange={handleSliderChange}
                  onCommit={handleSliderCommit}
                  disabled={updatePresetMutation.isPending}
                />
                {slidersSaved && <p className="text-sm text-green-600 mt-2">Sliders saved</p>}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inspire Me Topics</CardTitle>
          </CardHeader>
          <CardContent>
            <InspireMeTopics
              topics={topics ?? []}
              onAdd={(topic) => addTopicMutation.mutate(topic)}
              onDelete={(topicId) => removeTopicMutation.mutate(topicId)}
              isAdding={addTopicMutation.isPending}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">PIN Management</CardTitle>
          </CardHeader>
          <CardContent>
            {pinSaved && <p className="text-sm text-green-600 mb-2">PIN updated</p>}
            {!showPinReset ? (
              <Button
                variant="outline"
                onClick={() => {
                  setShowPinReset(true)
                  setPinSaved(false)
                }}
              >
                Reset PIN
              </Button>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="New 4-digit PIN"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  aria-label="New PIN"
                />
                <Button onClick={handlePinReset} disabled={newPin.length !== 4 || updateChildMutation.isPending}>
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPinReset(false)
                    setNewPin('')
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
