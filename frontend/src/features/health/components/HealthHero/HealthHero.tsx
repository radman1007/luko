import { LUKORIANS } from '@/lib/characters';
import styles from './HealthHero.module.css';

export function HealthHero() {
  const doctor = LUKORIANS.health;

  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>لوکو سلامت</p>
        <h1 className={styles.name}>{doctor.name}</h1>
        <p className={styles.role}>{doctor.role}</p>
        <p className={styles.tagline}>«حال دلت برای من مهمه!»</p>
      </div>
      <img className={styles.character} src={doctor.image} alt={doctor.name} />
    </header>
  );
}
