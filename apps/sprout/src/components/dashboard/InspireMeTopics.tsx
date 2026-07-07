import type { KeyboardEvent } from 'react'
import { useState } from 'react'

import type { ParentSeededTopic } from '../../features/topics/topicsQueries.ts'
import { Button } from '../ui/button.tsx'
import { Input } from '../ui/input.tsx'
import styles from './InspireMeTopics.module.scss'

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
    <div className={styles.container}>
      {topics.length === 0 ? (
        <p className={styles.empty}>No topics yet. Add some to inspire conversations.</p>
      ) : (
        <ul className={styles.list}>
          {topics.map((topic) => (
            <li key={topic.id} className={styles.item}>
              <span className={styles.topic}>{topic.topic}</span>
              <button
                type="button"
                onClick={() => onDelete(topic.id)}
                className={styles.delete}
                aria-label={`Delete topic ${topic.topic}`}
              >
                X
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.inputRow}>
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
