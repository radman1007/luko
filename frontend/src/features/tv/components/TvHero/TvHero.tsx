import { LUKORIANS } from '@/lib/characters';
import styles from './TvHero.module.css';

export function TvHero() {
  const host = LUKORIANS.tv;

  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>لوکو تلویزیون</p>
        <h1 className={styles.name}>{host.name}</h1>
        <p className={styles.role}>{host.role}</p>
        <p className={styles.tagline}>«امروز چی ببینیم؟»</p>
      </div>
      <img className={styles.character} src={host.image} alt={host.name} />
    </header>
  );
}
