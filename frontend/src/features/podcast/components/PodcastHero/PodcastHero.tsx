import { LUKORIANS } from '@/lib/characters';
import styles from './PodcastHero.module.css';

export function PodcastHero() {
  const host = LUKORIANS.podcast;

  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>لوکو پادکست</p>
        <h1 className={styles.name}>{host.name}</h1>
        <p className={styles.role}>{host.role}</p>
        <p className={styles.tagline}>«هدفونت رو بذار، بزن بریم!»</p>
      </div>
      <img className={styles.character} src={host.image} alt={host.name} />
    </header>
  );
}
