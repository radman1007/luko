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

/**
 * پرده‌ی ابر روی هفته‌های نرسیده. مرحله‌ها عمداً دیده نمی‌شوند —
 * فقط سایه‌ی محوشان پیداست تا بچه بداند مسیر ادامه دارد.
 */
export function CloudGate({ weeks, daysToNextWeek }: Props) {
  if (weeks.length === 0) return null;

  const hiddenStages = weeks.reduce((sum, week) => sum + week.stages.length, 0);

  return (
    <section className={styles.gate} aria-label="مرحله‌های هنوز باز نشده">
      {/* سایه‌ی مرحله‌های پنهان، پشتِ ابرها */}
      <div className={styles.ghosts} aria-hidden>
        {Array.from({ length: Math.min(hiddenStages, 6) }).map((_, i) => (
          <span key={i} className={i % 2 === 0 ? styles.ghostStart : styles.ghostEnd} />
        ))}
      </div>

      <div className={styles.clouds} aria-hidden>
        <Cloud className={styles.cloudBack} />
        <Cloud className={styles.cloudMid} />
        <Cloud className={styles.cloudFront} />
      </div>

      <div className={styles.note}>
        <span className={styles.lock} aria-hidden>
          <HiOutlineLockClosed />
        </span>
        <p className={styles.noteTitle}>
          پشتِ ابرها {hiddenStages.toLocaleString('fa-IR')} مرحله‌ی دیگر خوابیده است
        </p>
        <p className={styles.noteText}>
          {daysToNextWeek === undefined
            ? 'به‌زودی باز می‌شوند.'
            : daysToNextWeek === 0
              ? 'همین امروز ابرها کنار می‌روند و هفته‌ی تازه باز می‌شود!'
              : `${daysToNextWeek.toLocaleString('fa-IR')} روز دیگر ابرها کنار می‌روند و هفته‌ی تازه باز می‌شود.`}
        </p>
      </div>
    </section>
  );
}
