import { LevelCard } from '../components/LevelCard.tsx'
import { SiteHeader } from '../components/SiteHeader.tsx'
import { DIFFICULTIES } from '../server/wordGenerator.ts'
import { formatShortDate } from '../formatDate.ts'
import styles from './HomePage.module.scss'

export function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.home} data-testid="home-page">
        <p className={styles.date}>{formatShortDate(new Date())}</p>
        <div className={styles.headlineRow}>
          <div>
            <h1 className={styles.heading}>
              Pick a level, <br className={styles.mobileBreak} />
              any level!
            </h1>
            <span className={styles.accentRule} />
          </div>
          <p className={styles.intro}>
            One new word every day. Have a guess at what it means before you reveal the definition.
          </p>
        </div>
        <div className={styles.grid}>
          {DIFFICULTIES.map((level) => (
            <LevelCard key={level} level={level} />
          ))}
        </div>
      </main>
    </>
  )
}
