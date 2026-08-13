import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'

import { SpeakerIcon } from '../components/icons.tsx'
import { WordHeader } from '../components/WordHeader.tsx'
import { speak, speechSupported } from '../features/speech/speak.ts'
import { todayWordsQueryOptions } from '../features/wotd/todayWordsQuery.ts'
import { formatShortDate } from '../formatDate.ts'
import type { Difficulty, WordOfTheDay } from '../server/wordGenerator.ts'
import styles from './WotdPage.module.scss'

export function WotdPage() {
  const { level } = useSearch({ from: '/wotd' })
  // Keyed by level so the reveal state resets when the level changes.
  return <WordScreen key={level} level={level} />
}

/**
 * The word screen (frames 5b/5c/5e/5f). Pre-reveal it shows the word with a
 * guess prompt; "Show Definition" reveals the entry card in place. The two
 * breakpoints place the revealed pieces differently — mobile puts the
 * synonyms inside the card, a circular audio button in the type row and a
 * full-width hide button below; desktop keeps the "Hear it" pill, adds a
 * ghost "Hide definition" beside it and the synonyms under a rule in the
 * left column. Both variants are rendered and the stylesheet shows the one
 * the breakpoint wants.
 */
function WordScreen({ level }: { level: Difficulty }) {
  const { data, isPending, isError } = useQuery(todayWordsQueryOptions)
  const [revealed, setRevealed] = useState(false)
  // Hide animates the guess block back in — but not on first paint.
  const [hasRevealed, setHasRevealed] = useState(false)
  const word = data?.find((entry) => entry.difficulty === level)

  return (
    <>
      <WordHeader level={level} />
      <main
        className={styles.wotd}
        data-level={level}
        data-revealed={revealed || undefined}
        data-testid="wotd-page"
      >
        {isPending && <p className={styles.status}>Loading…</p>}
        {isError && <p className={styles.status}>Something went wrong.</p>}
        {word && (
          <div className={styles.grid}>
            <div className={styles.wordColumn}>
              <p className={styles.date}>{formatShortDate(new Date())}</p>
              <h1 className={styles.word} data-testid="wotd-word">
                {word.word}
              </h1>
              {(word.wordType || word.respelling || revealed) && (
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
                  {revealed && <HearItButton word={word.word} variant="circle" />}
                </p>
              )}
              <div className={styles.actions}>
                <HearItButton word={word.word} variant="pill" />
                {revealed && (
                  <button
                    className={`${styles.hideGhost} ${styles.reveal}`}
                    onClick={() => setRevealed(false)}
                  >
                    Hide definition
                  </button>
                )}
              </div>
              {revealed && (
                <div className={`${styles.synonymsBlock} ${styles.reveal}`}>
                  <SynonymPills synonyms={word.synonyms} />
                </div>
              )}
            </div>
            {revealed ? (
              <EntryCard word={word} onHide={() => setRevealed(false)} />
            ) : (
              <div className={hasRevealed ? `${styles.guess} ${styles.reveal}` : styles.guess}>
                <p className={styles.prompt}>Have a guess first — what do you think it means?</p>
                <p className={styles.promptSub}>
                  Say it out loud, or write it down, then check how close you got.
                </p>
                <button
                  className={styles.show}
                  onClick={() => {
                    setRevealed(true)
                    setHasRevealed(true)
                  }}
                >
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

/**
 * The revealed entry (frames 5c/5f): Definition and Example groups with
 * eyebrow labels; the synonyms group and the full-width hide button are the
 * mobile layout's — desktop hides them and uses the left column's instead.
 */
function EntryCard({ word, onHide }: { word: WordOfTheDay; onHide: () => void }) {
  return (
    <div className={`${styles.entryColumn} ${styles.reveal}`}>
      <div className={styles.entry}>
        <div className={styles.entryGroup} data-testid="wotd-definition">
          <p className={styles.entryLabel}>Definition</p>
          <p className={styles.definitionBody}>{word.definition}</p>
        </div>
        <div className={styles.entryGroup} data-testid="wotd-sentence">
          <p className={styles.entryLabel}>Example</p>
          <p className={styles.exampleBody}>{word.exampleSentence}</p>
        </div>
        <div className={`${styles.entryGroup} ${styles.entrySynonyms}`}>
          <SynonymPills synonyms={word.synonyms} />
        </div>
      </div>
      <button className={styles.hide} onClick={onHide}>
        Hide Definition
      </button>
    </div>
  )
}

/** Eyebrow label + level-tinted pills; used by both breakpoint layouts. */
function SynonymPills({ synonyms }: { synonyms: string[] }) {
  return (
    <>
      <p className={styles.entryLabel}>Synonyms</p>
      <ul className={styles.synonyms} data-testid="wotd-synonyms">
        {synonyms.map((synonym) => (
          <li key={synonym}>{synonym}</li>
        ))}
      </ul>
    </>
  )
}

/**
 * The "Hear it" control; the speaker icon pulses while the word plays. The
 * pill form sits under the type row (hidden on mobile once revealed); the
 * circle form is the mobile revealed type-row button (hidden on desktop).
 */
function HearItButton({ word, variant }: { word: string; variant: 'pill' | 'circle' }) {
  const [playing, setPlaying] = useState(false)
  if (!speechSupported()) return null
  return (
    <button
      className={variant === 'pill' ? styles.hearIt : styles.hearItCircle}
      data-playing={playing || undefined}
      onClick={() =>
        speak(word, { onStart: () => setPlaying(true), onEnd: () => setPlaying(false) })
      }
      aria-label={`Play the word ${word}`}
      data-testid="wotd-speak"
    >
      <SpeakerIcon
        size={variant === 'pill' ? 19 : 17}
        strokeWidth={1.8}
        className={styles.hearItIcon}
      />
      {variant === 'pill' && 'Hear it'}
    </button>
  )
}
