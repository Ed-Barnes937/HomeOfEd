// Ported from the source (behaviour/markup). Tailwind classes retained; SCSS is P7.
import type { KeyboardEvent } from 'react'
import { useState } from 'react'

import type { ParentSeededTopic } from '../../features/topics/topicsQueries.ts'
import { Button } from '../ui/button.tsx'
import { Input } from '../ui/input.tsx'

interface InspireMeTopicsProps {
  topics: ParentSeededTopic[]
  onAdd: (topic: string) => void
  onDelete: (topicId: string) => void
  isAdding?: boolean
}

export function InspireMeTopics({ topics, onAdd, onDelete, isAdding }: InspireMeTopicsProps) {
  const [newTopic, setNewTopic] = useState('')

  const handleAdd = () => {
    const trimmed = newTopic.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewTopic('')
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {topics.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No topics yet. Add some to inspire conversations.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {topics.map((topic) => (
            <li
              key={topic.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-sm">{topic.topic}</span>
              <button
                type="button"
                onClick={() => onDelete(topic.id)}
                className="text-muted-foreground hover:text-destructive ml-2 text-sm"
                aria-label={`Delete topic ${topic.topic}`}
              >
                X
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="e.g. Dinosaurs, Space, Cooking"
          value={newTopic}
          onChange={(e) => setNewTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="New topic"
          maxLength={200}
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={!newTopic.trim() || isAdding}>
          Add
        </Button>
      </div>
    </div>
  )
}
