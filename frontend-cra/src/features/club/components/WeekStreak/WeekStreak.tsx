import { HiOutlineFire } from 'react-icons/hi2';
import { WEEK_DAY_LABELS } from '../../clubData';
import styles from './WeekStreak.module.css';

interface Props {
  /** تاریخ‌های YYYY-MM-DD که مأموریتی انجام شده */
  days: string[];
  streak: number;
}

/** روزهای هفته‌ی جاری از شنبه؛ وضعیت هر روز از لاگ فعالیت */
export function WeekStreak({ days, streak }: Props) {
  const done = new Set(days);
  const now = new Date();
  const saturday = new Date(now);
  saturday.setDate(now.getDate() - ((now.getDay() + 1) % 7));

  const week = WEEK_DAY_LABELS.map((label, i) => {
    const date = new Date(saturday);
    date.setDate(saturday.getDate() + i);
    const key = date.toLocaleDateString('en-CA');
    return {
      label,
      key,
      isDone: done.has(key),
      isToday: key === now.toLocaleDateString('en-CA'),
      isFuture: date > now,
    };
  });

  return (
    <section className={styles.card} aria-label="استریک هفته">
      <div className={styles.head}>
        <h2 className={styles.title}>این هفته</h2>
        <span className={styles.streak}>
          <HiOutlineFire aria-hidden />
          {streak.toLocaleString('fa-IR')} روز پیاپی
        </span>
      </div>
      <div className={styles.days}>
        {week.map((day) => (
          <div
            key={day.key}
            className={[
              styles.day,
              day.isDone ? styles.done : '',
              day.isToday ? styles.today : '',
              day.isFuture ? styles.future : '',
            ].join(' ')}
          >
            <span className={styles.dot} aria-hidden />
            <span className={styles.label}>{day.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
