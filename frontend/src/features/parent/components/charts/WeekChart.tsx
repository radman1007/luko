import type { CSSProperties } from 'react';
import type { DayActivity } from '../../types';
import styles from './WeekChart.module.css';

interface Props {
  week: DayActivity[];
}

/** ستون‌های دقیقه‌ی هر روزِ هفته + خط‌چینِ میانگین */
export function WeekChart({ week }: Props) {
  const minutes = week.map((day) => day.minutes);
  const max = Math.max(...minutes, 10);
  const total = minutes.reduce((sum, value) => sum + value, 0);
  const activeDays = minutes.filter((value) => value > 0).length;
  const average = Math.round(total / (week.length || 1));

  // هفته‌ی کاملاً خالی: ستون‌های صفر چیزی نمی‌گویند، پس فقط جمله می‌ماند
  if (total === 0) {
    return (
      <p className={styles.emptyWeek}>
        در هفت روز گذشته هیچ بازی‌ای ثبت نشده است. با «بازی روز» می‌توانید شروعش کنید.
      </p>
    );
  }

  return (
    <>
      <div className={styles.cols}>
        {week.map((day, i) => (
          <div key={day.day} className={day.minutes > 0 ? styles.colOn : styles.col}>
            <span className={styles.value}>
              {day.minutes > 0 ? day.minutes.toLocaleString('fa-IR') : ' '}
            </span>
            {day.minutes > 0 ? (
              <span
                className={styles.bar}
                style={
                  {
                    '--h': `${Math.round((day.minutes / max) * 100)}%`,
                    animationDelay: `${i * 80}ms`,
                  } as CSSProperties
                }
              />
            ) : (
              <span className={styles.dot} aria-hidden />
            )}
          </div>
        ))}

        {total > 0 && (
          <div
            className={styles.avg}
            style={{ bottom: `${Math.max((average / max) * 100, 5)}%` }}
            aria-hidden
          >
            <span>میانگین {average.toLocaleString('fa-IR')} دقیقه</span>
            <i />
          </div>
        )}
      </div>

      <div className={styles.labels}>
        {week.map((day) => (
          <span key={day.day}>{day.day}</span>
        ))}
      </div>

      <p className={styles.foot}>
        مجموع این هفته <b>{total.toLocaleString('fa-IR')} دقیقه</b> در{' '}
        <b>{activeDays.toLocaleString('fa-IR')} روز</b> — عدد روی هر ستون، دقیقه‌های همان روز است.
      </p>
    </>
  );
}
