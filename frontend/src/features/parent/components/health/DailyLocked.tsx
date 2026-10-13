import { HiOutlineAcademicCap, HiOutlineLightBulb, HiOutlineStar, HiOutlineSun } from 'react-icons/hi2';
import { CrownIcon, MoodFaceIcon } from '@/components/ui/icons';
import type { MoodVariant } from '@/components/ui/icons';
import type { HealthLocked } from '../../types';
import { MOOD_LOOK, fa } from './moods';
import styles from './DailyLocked.module.css';

interface Props {
  teaser: HealthLocked['teaser'];
  childName: string;
  onUpgrade: () => void;
}

/** نمونه‌ی ثابتِ پشتِ قفل — داده‌ی واقعی نیست؛ داده‌ی واقعی بی‌اشتراک به مرورگر نمی‌رسد (gating.py) */
const SAMPLE: { label: string; mood: MoodVariant; width: number }[] = [
  { label: 'صبح', mood: 'happy', width: 82 },
  { label: 'ظهر', mood: 'calm', width: 64 },
  { label: 'عصر', mood: 'happy', width: 74 },
  { label: 'شب', mood: 'tired', width: 40 },
];
const WEEK = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/**
 * «حالِ دقیقِ روزانه» برای والدِ بی‌اشتراک: نمای محوی از آن‌چه منتظرش است، چهار چیزی که باز می‌شود
 * و اندازه‌ی واقعیِ تحلیلِ فرزندش (فقط شمارش‌ها).
 */
export function DailyLocked({ teaser, childName, onUpgrade }: Props) {
  const features = [
    { icon: HiOutlineSun, text: 'حالش در صبح، ظهر، عصر و شب' },
    { icon: HiOutlineAcademicCap, text: 'با کدام درس‌ها حالش بهتر می‌شود' },
    { icon: HiOutlineStar, text: 'به چه چیزهایی علاقه دارد و جذبش می‌شود' },
    {
      icon: HiOutlineLightBulb,
      text: teaser.tips >= 3 ? `${fa(teaser.tips)} پیشنهادِ دقیق‌تر برای همین هفته` : 'پیشنهادهای دقیق‌تر برای همین هفته',
    },
  ];
  return (
    <section className={styles.card} aria-labelledby="daily-locked-title">
      <div className={styles.preview} aria-hidden>
        <div className={styles.days}>
          {WEEK.map((d, i) => <span key={d} data-on={i === 4 || undefined}>{d}</span>)}
        </div>
        {SAMPLE.map((row) => (
          <div key={row.label} className={styles.row}>
            <span>{row.label}</span>
            <i style={{ color: MOOD_LOOK[row.mood].color }}><MoodFaceIcon variant={row.mood} size={16} /></i>
            <b><em style={{ width: `${row.width}%` }} /></b>
          </div>
        ))}
      </div>

      <div className={styles.overlay}>
        <span className={styles.lock} aria-hidden><CrownIcon size={22} strokeWidth={2} /></span>
        <h3 id="daily-locked-title">حالِ دقیقِ روزانه‌ی {childName}</h3>
        <p className={styles.lead}>
          {teaser.checkins > 0
            ? `${fa(teaser.checkins)} بار گفتنِ حال در چهار هفته‌ی اخیر آماده‌ی تحلیل است.`
            : `به‌محضِ این‌که ${childName} حالش را در لوکو بگوید، تحلیلِ دقیق این‌جا ساخته می‌شود.`}
        </p>
        <ul className={styles.features}>
          {features.map(({ icon: Icon, text }) => (
            <li key={text}><Icon aria-hidden />{text}</li>
          ))}
        </ul>
        <button type="button" className={styles.cta} onClick={onUpgrade}>
          باز کردن با اشتراک
        </button>
      </div>
    </section>
  );
}
