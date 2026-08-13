import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import { SpeakerIcon } from '../components/icons.tsx'
import { WordHeader } from '../components/WordHeader.tsx'
import { WOTDDefinition } from '../components/WOTDDefinition.tsx'
import { WOTDSentence } from '../components/WOTDSentence.tsx'
import { speak, speechSupported } from '../features/speech/speak.ts'
import { todayWordsQueryOptions } from '../features/wotd/todayWordsQuery.ts'
import { formatShortDate } from '../formatDate.ts'
import type { Difficulty } from '../server/wordGenerator.ts'
import styles from './WotdPage.module.scss'

export function WotdPage() {
  const { level } = useSearch({ from: '/wotd' })
  // Keyed by level so the reveal state resets when the level changes.
  return <WordScreen key={level} level={level} />
}

/**
 * The word screen (frames 5b/5e). Mobile: a single column — date, the word at
 * 56px, type + respelling, "Hear it", then the guess block under a rule.
 * Desktop: a two-column grid — the word at 92px on the left, the dashed guess
 * card on the right. The level's colour carries the pill, badge and primary
 * button via the data-level binding.
 */
function WordScreen({ level }: { level: Difficulty }) {
  const { data, isPending, isError } = useQuery(todayWordsQueryOptions)
  const [revealed, setRevealed] = useState(false)
  const word = data?.find((entry) => entry.difficulty === level)

  return (
    <>
      <WordHeader level={level} />
      <main className={styles.wotd} data-level={level} data-testid="wotd-page">
        {isPending && <p className={styles.status}>Loading…</p>}
        {isError && <p className={styles.status}>Something went wrong.</p>}
        {word && (
          <div className={styles.grid}>
            <div className={styles.wordColumn}>
              <p className={styles.date}>{formatShortDate(new Date())}</p>
              <h1 className={styles.word} data-testid="wotd-word">
                {word.word}
              </h1>
              {(word.wordType || word.respelling) && (
                <p className={styles.typeRow}>
                  {word.wordType && (
                    <span className={styles.wordType} data-testid="wotd-word-type">
                      {word.wordType}
                    </span>
                  )}
                  {word.respelling && (
                    <span className={styles.respelling} data-testid="wotd-respelling">
                      {word.respelling}
                    </span>
                  )}
                </p>
              )}
              <HearItButton word={word.word} />
            </div>
            {revealed ? (
              // Functional reveal only — ticket 05 restyles this as the entry card.
              <div className={styles.entry}>
                <WOTDDefinition definition={word.definition} />
                <WOTDSentence sentence={word.exampleSentence} />
                <p className={styles.synonymsLabel}>Synonyms</p>
                <ul className={styles.synonyms} data-testid="wotd-synonyms">
                  {word.synonyms.map((synonym) => (
                    <li key={synonym}>{synonym}</li>
                  ))}
                </ul>
                <button className={styles.hide} onClick={() => setRevealed(false)}>
                  Hide Definition
                </button>
              </div>
            ) : (
              <div className={styles.guess}>
                <p className={styles.prompt}>Have a guess first — what do you think it means?</p>
                <p className={styles.promptSub}>
                  Say it out loud, or write it down, then check how close you got.
                </p>
                <button className={styles.show} onClick={() => setRevealed(true)}>
                  Show Definition
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}

/** The "Hear it" pill; the speaker icon pulses while the word plays. */
function HearItButton({ word }: { word: string }) {
  const [playing, setPlaying] = useState(false)
  if (!speechSupported()) return null
  return (
    <button
      className={styles.hearIt}
      data-playing={playing || undefined}
      onClick={() =>
        speak(word, { onStart: () => setPlaying(true), onEnd: () => setPlaying(false) })
      }
      aria-label={`Play the word ${word}`}
      data-testid="wotd-speak"
    >
      <SpeakerIcon size={19} strokeWidth={1.8} className={styles.hearItIcon} />
      Hear it
    </button>
  )
}
