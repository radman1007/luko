import type { CSSProperties } from 'react';
import type { HourBucket } from '../../types';
import styles from './HoursChart.module.css';

interface Props {
  hours: HourBucket[];
}

/** ترتیبِ راست‌به‌چپ: شب، بعدازظهر، صبح، بامداد */
const ORDER = [
  18, 19, 20, 21, 22, 23,
  12, 13, 14, 15, 16, 17,
  6, 7, 8, 9, 10, 11,
  0, 1, 2, 3, 4, 5,
];

const GROUPS = [
  { label: 'شب', hint: '۱۸ تا ۲۳' },
  { label: 'بعدازظهر', hint: '۱۲ تا ۱۷' },
  { label: 'صبح', hint: '۶ تا ۱۱' },
  { label: 'بامداد', hint: '۰ تا ۵' },
];

/** ساعت‌های بازی در شبانه‌روز — برای فهمیدنِ بازیِ نزدیکِ خواب */
export function HoursChart({ hours }: Props) {
  const byHour = new Map(hours.map((bucket) => [bucket.hour, bucket]));
  const total = hours.reduce((sum, bucket) => sum + bucket.count, 0);
  const peak = hours.reduce(
    (best, bucket) => (bucket.count > best.count ? bucket : best),
    hours[0] ?? { hour: 0, count: 0, intensity: 0 },
  );
  const lateNight = hours
    .filter((bucket) => bucket.hour >= 21 || bucket.hour <= 5)
    .reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <>
      <div className={styles.slots}>
        {ORDER.map((hour, i) => {
          const bucket = byHour.get(hour);
          const value = bucket?.count ?? 0;
          return (
            <span
              key={hour}
              className={styles.slot}
              title={`ساعت ${hour.toLocaleString('fa-IR')} — ${value.toLocaleString('fa-IR')} تعامل`}
            >
              {value > 0 && (
                <i
                  style={
                    {
                      '--h': `${bucket?.intensity ?? 0}%`,
                      animationDelay: `${i * 28}ms`,
                    } as CSSProperties
                  }
                />
              )}
            </span>
          );
        })}
      </div>

      <div className={styles.groups}>
        {GROUPS.map((group) => (
          <div key={group.label}>
            <b>{group.label}</b>
            <small>{group.hint}</small>
          </div>
        ))}
      </div>

      <p className={styles.foot}>
        {total > 0 ? (
          <>
            پرکارترین ساعت: <b>{peak.hour.toLocaleString('fa-IR')}</b> ·{' '}
            {lateNight > 0 ? (
              <>
                <b>{Math.round((lateNight / total) * 100).toLocaleString('fa-IR')}٪</b> از فعالیت بعد
                از ۲۱ یا قبل از ۶ صبح بوده است.
              </>
            ) : (
              'هیچ بازی‌ای در ساعت‌های نزدیک خواب ثبت نشده است.'
            )}
          </>
        ) : (
          'هنوز فعالیتی برای تحلیل ساعتی ثبت نشده است.'
        )}
      </p>
    </>
  );
}
