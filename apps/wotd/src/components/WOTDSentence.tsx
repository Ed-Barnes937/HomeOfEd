import styles from './WOTDSentence.module.scss'
import { Typography } from './Typography.tsx'

type WOTDSentenceProps = { sentence: string }

export function WOTDSentence({ sentence }: WOTDSentenceProps) {
  return (
    <div className={styles.sentence} data-testid="wotd-sentence">
      <Typography>Example: {sentence}</Typography>
    </div>
  )
}
