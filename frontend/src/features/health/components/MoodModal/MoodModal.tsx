import { MoodFaceIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { MOODS } from '../../moods';
import type { Mood } from '../../types';
import styles from './MoodModal.module.css';

interface Props {
  onSelect: (mood: Mood) => void;
  onClose: () => void;
}

export function MoodModal({ onSelect, onClose }: Props) {
  const doctor = LUKORIANS.health;
  useEscapeKey(onClose);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="ثبت حال">
      <div className={styles.sheet}>
        <img className={styles.character} src={doctor.image} alt={doctor.name} />
        <p className={styles.speaker}>{doctor.name} می‌پرسه:</p>
        <h2 className={styles.title}>الان چه حسی داری؟</h2>
        <div className={styles.moods}>
          {MOODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className={styles.mood}
              onClick={() => onSelect(value)}
            >
              <MoodFaceIcon variant={value} size={38} className={styles.face} />
              <span className={styles.label}>{label}</span>
            </button>
          ))}
        </div>
        <button type="button" className={styles.skip} onClick={onClose}>
          بعداً می‌گم
        </button>
      </div>
    </div>
  );
}
