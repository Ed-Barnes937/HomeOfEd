import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { speak, speechSupported } from '../features/speech/speak.ts'
import { todayWordsQueryOptions } from '../features/wotd/todayWordsQuery.ts'
import type { Difficulty } from '../server/wordGenerator.ts'
import { Button } from './Button.tsx'
import { SpeakerIcon } from './icons.tsx'
import styles from './WOTDCard.module.scss'
import { WOTDDefinition } from './WOTDDefinition.tsx'
import { WOTDSentence } from './WOTDSentence.tsx'

type WOTDCardProps = { level: Difficulty }

export function WOTDCard({ level }: WOTDCardProps) {
  const { data, isPending, isError } = useQuery(todayWordsQueryOptions)
  const [showDefinition, setShowDefinition] = useState(true)
  const word = data?.find((entry) => entry.difficulty === level)

  return (
    <div className={styles.card} data-level={level} data-testid="wotd-card">
      {isPending && <p>Loading…</p>}
      {isError && <p>Something went wrong.</p>}
      {word && (
        <>
          <div className={styles.wordRow}>
            <p className={styles.word} data-testid="wotd-word">
              {word.word}
            </p>
            {speechSupported() && (
              <Button
                variant="ghost"
                className={styles.speak}
                onClick={() => speak(word.word)}
                aria-label={`Play the word ${word.word}`}
                data-testid="wotd-speak"
              >
                <SpeakerIcon size={28} />
              </Button>
            )}
          </div>
          <Button className={styles.toggle} onClick={() => setShowDefinition((showing) => !showing)}>
            {showDefinition ? 'Hide Definition' : 'Show Definition'}
          </Button>
          {showDefinition && (
            <div className={styles.details}>
              <WOTDDefinition definition={word.definition} />
              <WOTDSentence sentence={word.exampleSentence} />
              <p className={styles.synonymsLabel}>Synonyms</p>
              <ul className={styles.synonyms} data-testid="wotd-synonyms">
                {word.synonyms.map((synonym) => (
                  <li key={synonym}>{synonym}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
