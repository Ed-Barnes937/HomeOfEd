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
import {
  childConfigQueryOptions,
  childrenQueryOptions,
  resetPin,
  updateChild,
  updatePreset,
} from '../features/children/childrenQueries.ts'
import { useRequireParent } from '../features/parentAuth/useRequireParent.ts'
import { addTopic, removeTopic, topicsQueryOptions } from '../features/topics/topicsQueries.ts'
import styles from './ChildSettingsPage.module.scss'

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
  const [pinReset, setPinReset] = useState(false)
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
  const resetPinMutation = useMutation({
    mutationFn: resetPin,
    onSuccess: () => {
      invalidateChild()
      setShowPinReset(false)
      setPinReset(true)
    },
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
      <div className={styles.loading}>
        <p className={styles.mutedText}>Loading...</p>
      </div>
    )
  }

  if (!session.data) return null

  if (!child) {
    return (
      <div className={styles.page}>
        <p className={styles.mutedText}>Child not found.</p>
        <Link to="/parent/children" className={styles.notFoundLink}>
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

  return (
    <div className={styles.page}>
      <Link to="/parent/children" className={styles.backLink}>
        Back to children
      </Link>

      <h1 className={styles.heading}>{child.displayName}&apos;s Settings</h1>

      <div className={styles.sections}>
        <Card>
          <CardHeader>
            <CardTitle className={styles.cardTitle}>Preset</CardTitle>
          </CardHeader>
          <CardContent>
            <PresetSelector
              value={child.presetName}
              onChange={handlePresetChange}
              disabled={updateChildMutation.isPending}
            />
            {presetSaved && <p className={styles.savedMessage}>Preset saved</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={styles.cardTitle}>Guardrail Sliders</CardTitle>
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
                {slidersSaved && <p className={styles.savedMessage}>Sliders saved</p>}
              </>
            ) : (
              <p className={styles.mutedTextSm}>Loading...</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className={styles.cardTitle}>Inspire Me Topics</CardTitle>
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
            <CardTitle className={styles.cardTitle}>PIN Management</CardTitle>
          </CardHeader>
          <CardContent>
            {pinReset && (
              <p className={styles.savedMessageTop}>
                PIN reset. {child.displayName}&apos;s password is now their username (
                {child.username}) — they&apos;ll choose a new password and PIN when they next
                log in.
              </p>
            )}
            {!showPinReset ? (
              <Button
                variant="outline"
                onClick={() => {
                  setShowPinReset(true)
                  setPinReset(false)
                }}
              >
                Reset PIN
              </Button>
            ) : (
              <>
                <p className={styles.mutedTextSm}>
                  This clears {child.displayName}&apos;s PIN and resets their password to their
                  username ({child.username}). They&apos;ll choose a new password and PIN at
                  their next login — you won&apos;t see either.
                </p>
                <div className={styles.pinRow}>
                  <Button
                    onClick={() => resetPinMutation.mutate(childId)}
                    disabled={resetPinMutation.isPending}
                  >
                    Confirm reset
                  </Button>
                  <Button variant="outline" onClick={() => setShowPinReset(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
