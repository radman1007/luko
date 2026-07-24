import { useNavigate } from 'react-router-dom';
import { HiOutlineHeart, HiOutlineCloud } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { MOOD_LABEL } from '@/features/health/moods';
import type { Mood } from '@/features/health/types';
import styles from './HealthMiniCard.module.css';

interface Props {
  lastMood: Mood | null;
}

export function HealthMiniCard({ lastMood }: Props) {
  const navigate = useNavigate();
  const doctor = LUKORIANS.health;

  return (
    <section className={styles.card} aria-label="لوکو سلامت">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          <HiOutlineHeart aria-hidden />
          لوکو سلامت
        </h2>
        <span className={styles.hostBadge}>مطب {doctor.name}</span>
      </div>
      <p className={styles.desc}>
        حال دلت، نفس جادویی، بوم نقاشی و صندوقچه‌ی راز — همه پیش {doctor.name}!
      </p>

      <div className={styles.statusRow}>
        <button type="button" className={styles.status} onClick={() => navigate('/luko-health')}>
          <MoodFaceIcon variant={lastMood ?? 'calm'} size={30} className={lastMood ? '' : styles.dimmed} />
          <span className={styles.statusLabel}>
            {lastMood ? `حس امروز: ${MOOD_LABEL[lastMood]}` : 'حالتو نگفتی!'}
          </span>
        </button>
        <button type="button" className={styles.status} onClick={() => navigate('/luko-health')}>
          <HiOutlineCloud size={30} />
          <span className={styles.statusLabel}>نفس جادویی</span>
        </button>
      </div>

      <button type="button" className={styles.cta} onClick={() => navigate('/luko-health')}>
        بریم مطب
      </button>
    </section>
  );
}
