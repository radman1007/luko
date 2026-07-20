import { HiOutlinePencilSquare } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import { MOOD_LABEL } from '../../moods';
import type { Mood } from '../../types';
import styles from './MoodCheckinCard.module.css';

interface Props {
  lastMood: Mood | null;
  onOpen: () => void;
}

export function MoodCheckinCard({ lastMood, onOpen }: Props) {
  return (
    <section className={styles.card} aria-label="ثبت حال">
      <div className={styles.faceWrap}>
        {lastMood ? (
          <MoodFaceIcon variant={lastMood} size={44} />
        ) : (
          <MoodFaceIcon variant="calm" size={44} className={styles.dimmed} />
        )}
      </div>
      <div className={styles.texts}>
        <h2 className={styles.title}>
          {lastMood ? `آخرین حست: ${MOOD_LABEL[lastMood]}` : 'هنوز حالت رو نگفتی'}
        </h2>
        <p className={styles.subtitle}>هر وقت حست عوض شد به دکتر نیلا بگو</p>
      </div>
      <button type="button" className={styles.action} onClick={onOpen} aria-label="ثبت حال جدید">
        <HiOutlinePencilSquare />
      </button>
    </section>
  );
}
