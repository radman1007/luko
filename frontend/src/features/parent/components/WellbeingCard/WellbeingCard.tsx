import { MoodFaceIcon } from '@/components/ui/icons';
import type { MoodVariant } from '@/components/ui/icons';
import type { ChildReport } from '../../types';
import styles from './WellbeingCard.module.css';

interface Props {
  moods: ChildReport['moods'];
  wellbeing: ChildReport['wellbeing'];
}

const MOOD_TEXT: Record<MoodVariant, string> = {
  happy: 'خوشحال',
  calm: 'آرام',
  tired: 'خسته',
  sad: 'ناراحت',
  angry: 'عصبانی',
};

const MOOD_CLASS: Record<MoodVariant, string> = {
  happy: styles.moodGood,
  calm: styles.moodCalm,
  tired: styles.moodTired,
  sad: styles.moodLow,
  angry: styles.moodLow,
};

/** حالِ روزانه و فعالیت‌های لوکو سلامت — بدونِ نمایشِ محتوای خصوصیِ بچه */
export function WellbeingCard({ moods, wellbeing }: Props) {
  const stats = [
    { label: 'ثبت حال', value: wellbeing.checkins },
    { label: 'تمرین تنفس', value: wellbeing.breathingSessions },
    { label: 'نقاشی', value: wellbeing.paintings },
  ];

  return (
    <div>
      <div className={styles.stats}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.stat}>
            <b className={styles.statValue}>{stat.value.toLocaleString('fa-IR')}</b>
            <span className={styles.statLabel}>{stat.label}</span>
          </div>
        ))}
        <div className={styles.stat}>
          <span className={styles.dominant}>
            <MoodFaceIcon variant={wellbeing.dominantMood} size={20} aria-hidden />
            {MOOD_TEXT[wellbeing.dominantMood]}
          </span>
          <span className={styles.statLabel}>حالِ غالب</span>
        </div>
      </div>

      <p className={styles.stripTitle}>۱۴ روز گذشته</p>
      <ul className={styles.strip}>
        {moods.map((entry) => (
          <li key={entry.day} className={MOOD_CLASS[entry.mood]} title={`روز ${entry.day} — ${MOOD_TEXT[entry.mood]}`}>
            <MoodFaceIcon variant={entry.mood} size={18} aria-hidden />
            <span className={styles.day}>{entry.day}</span>
          </li>
        ))}
      </ul>

      <p className={styles.privacy}>
        نوشته‌های «صندوقچهٔ رازها» رمزنگاری‌شده‌اند و برای هیچ‌کس — از جمله شما — قابل دیدن نیستند.
      </p>
    </div>
  );
}
