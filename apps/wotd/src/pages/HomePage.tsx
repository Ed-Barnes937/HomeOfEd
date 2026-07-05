import { LevelCard } from '../components/LevelCard.tsx'
import { Typography } from '../components/Typography.tsx'
import { DIFFICULTIES } from '../server/wordGenerator.ts'
import styles from './HomePage.module.scss'

export function HomePage() {
  return (
    <main className={styles.home} data-testid="home-page">
      <Typography variant="h2" className={styles.heading}>
        Pick a level, any level!
      </Typography>
      <div className={styles.grid}>
        {DIFFICULTIES.map((level) => (
          <LevelCard key={level} level={level} />
        ))}
      </div>
    </main>
  )
}
