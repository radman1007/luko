import { HiOutlineArrowTrendingDown, HiOutlineArrowTrendingUp } from 'react-icons/hi2';
import { MoodFaceIcon } from '@/components/ui/icons';
import type { MoodVariant } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { AiStatus, HealthVerdict, HealthWeekly } from '../../types';
import { AiBadge } from '../ai/AiBadge';
import { BreathIcon } from '../home/BreathIcon';
import { MoodMix } from './MoodMix';
import { fa } from './moods';
import styles from './MoodHero.module.css';

interface Props {
  weekly: HealthWeekly;
  ai?: AiStatus;
}

/** صورتکِ بزرگِ کنارِ حکم: حالِ غالب، و برای «هنوز ثبت نشده» صورتکِ آرام */
const VERDICT_FACE: Record<HealthVerdict, MoodVariant | null> = {
  great: 'happy', good: null, mixed: null, attention: null, none: 'calm',
};

/**
 * «حالِ کلیِ هفته» با دکتر نیلا: یک حکمِ ساده (عالی / خوب / متغیر / نیاز به توجه)، یکی دو جمله،
 * ترکیبِ حال‌ها و فعالیت‌های آرامش. عمداً وارد جزئیات نمی‌شود؛ جزئیات در «حالِ دقیقِ روزانه» است.
 */
export function MoodHero({ weekly, ai }: Props) {
  const face = VERDICT_FACE[weekly.verdict] ?? weekly.dominant ?? 'calm';
  const stats = [
    { key: 'checkins', icon: <MoodFaceIcon variant="happy" size={16} aria-hidden />, value: weekly.stats.checkins, label: 'بار گفتنِ حال' },
    { key: 'breathing', icon: <BreathIcon aria-hidden />, value: weekly.stats.breathing, label: 'تمرینِ تنفس' },
    { key: 'paintings', icon: <PaletteDot />, value: weekly.stats.paintings, label: 'نقاشی' },
  ];
  return (
    <section className={styles.hero} data-verdict={weekly.verdict} aria-labelledby="mood-week-title">
      <span className={styles.glow} aria-hidden />
      <img className={styles.mascot} src={LUKORIANS.health.image} alt="" aria-hidden loading="eager" decoding="async" />

      <div className={styles.text}>
        <div className={styles.head}>
          <div className={styles.chipRow}>
            <span className={styles.chip}>
              <span className={styles.chipLabel}>حالِ کلیِ هفته<i aria-hidden /></span>
              {weekly.period}
            </span>
            {weekly.verdict !== 'none' && <AiBadge ai={ai} written={weekly.source === 'ai'} />}
          </div>
          <div className={styles.verdictRow}>
            <span className={styles.verdict}>
              <MoodFaceIcon variant={face} size={20} aria-hidden />
              {weekly.label}
            </span>
            {weekly.trend === 'up' && (
              <span className={styles.trend} data-dir="up">
                <HiOutlineArrowTrendingUp aria-hidden /> بهتر از هفته‌ی پیش
              </span>
            )}
            {weekly.trend === 'down' && (
              <span className={styles.trend} data-dir="down">
                <HiOutlineArrowTrendingDown aria-hidden /> پایین‌تر از هفته‌ی پیش
              </span>
            )}
          </div>
          <h2 id="mood-week-title" className={styles.title}>{weekly.title}</h2>
        </div>
        <p className={styles.body}>{weekly.body}</p>

        {weekly.mix.length > 0 && <MoodMix mix={weekly.mix} />}

        <ul className={styles.stats}>
          {stats.map((item) => (
            <li key={item.key}>
              <span className={styles.stat}>{item.icon}<b>{fa(item.value)}</b></span>
              <span className={styles.statLabel}>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** نقطه‌های رنگیِ جعبه‌مداد — نشانِ کوچکِ «نقاشی» */
function PaletteDot() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.1-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10Z" />
      <circle cx="7.5" cy="11" r="1" fill="currentColor" />
      <circle cx="10.5" cy="7" r="1" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1" fill="currentColor" />
    </svg>
  );
}
