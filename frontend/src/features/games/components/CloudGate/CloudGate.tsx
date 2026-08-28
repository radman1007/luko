import { HiOutlineLockClosed } from 'react-icons/hi2';
import type { SeasonWeek } from '../../seasonData';
import styles from './CloudGate.module.css';

interface Props {
  weeks: SeasonWeek[];
  daysToNextWeek?: number;
}

/** یک ابرِ نرم — فقط تزئینی */
function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 220 90" aria-hidden focusable="false">
      <path
        fill="currentColor"
        d="M46 88c-19 0-34-13-34-30 0-15 12-27 27-29 4-17 20-29 39-29 16 0 30 9 37 22 5-3 11-5 17-5 17 0 31 13 32 29 15 2 26 14 26 29 0 8-4 13-4 13H46Z"
      />
    </svg>
  );
}

function countdown(days?: number): string {
  if (days === undefined) return 'به‌زودی کنار می‌روند.';
  if (days === 0) return 'همین امروز کنار می‌روند!';
  return `${days.toLocaleString('fa-IR')} روز دیگر کنار می‌روند.`;
}

/**
 * سقفِ نقشه. مسیر از زیرش رد می‌شود و ادامه‌اش پیدا نیست — مرحله‌های
 * هفته‌های نرسیده نه شمرده می‌شوند نه دیده، فقط می‌دانی که هست.
 */
export function CloudGate({ weeks, daysToNextWeek }: Props) {
  if (weeks.length === 0) return null;

  return (
    <section className={styles.gate} aria-label="مرحله‌های هنوز باز نشده">
      <div className={styles.sky} aria-hidden>
        <Cloud className={styles.back} />
        <Cloud className={styles.mid} />
        <Cloud className={styles.front} />
        <Cloud className={styles.far} />
      </div>

      <div className={styles.note}>
        <span className={styles.lock} aria-hidden>
          <HiOutlineLockClosed />
        </span>
        <p className={styles.title}>مسیر پشتِ ابرها ادامه دارد</p>
        <p className={styles.text}>{countdown(daysToNextWeek)}</p>
      </div>
    </section>
  );
}
