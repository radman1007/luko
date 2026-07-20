import { HiOutlineLockClosed } from 'react-icons/hi2';
import type { Medal } from '../../types';
import styles from './MedalsSection.module.css';

interface Props {
  medals: Medal[];
}

export function MedalsSection({ medals }: Props) {
  return (
    <section className={styles.card} aria-label="مدال‌ها">
      <h2 className={styles.title}>مدال‌های من</h2>
      <div className={styles.grid}>
        {medals.map((medal) => (
          <div
            key={medal.id}
            className={`${styles.medal} ${medal.unlocked ? styles.unlocked : ''}`}
            title={medal.description}
          >
            <span className={styles.iconWrap} aria-hidden>
              {medal.unlocked ? <medal.icon /> : <HiOutlineLockClosed />}
            </span>
            <span className={styles.medalTitle}>{medal.title}</span>
            <span className={styles.desc}>{medal.description}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
