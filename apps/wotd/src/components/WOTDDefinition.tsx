import styles from './WOTDDefinition.module.scss'
import { Typography } from './Typography.tsx'

type WOTDDefinitionProps = { definition: string }

export function WOTDDefinition({ definition }: WOTDDefinitionProps) {
  return (
    <div className={styles.definition} data-testid="wotd-definition">
      <Typography>{definition}</Typography>
    </div>
  )
}
