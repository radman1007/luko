import { useEffect, useRef, useState } from 'react';
import { HiOutlineLockClosed } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import type { SeasonWeek } from '../../seasonData';
import styles from './CloudGate.module.css';

interface Props {
  weeks: SeasonWeek[];
  daysToNextWeek?: number;
  /** طعمی از سیزنِ بعد که از لای ابر پیداست — بدونِ لو دادنِ کامل */
  hint?: string;
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
 * سقفِ نقشه.
 *
 * مسیر واقعاً از زیرِ ابرها رد می‌شود و ادامه‌اش پیدا نیست — مرحله‌های
 * هفته‌های نرسیده نه شمرده می‌شوند نه دیده. زدنِ ابرها لحظه‌ای کنارشان
 * می‌زند و سایه‌ی چیزی که آن پشت است پیدا می‌شود؛ نه آن‌قدر که لو برود،
 * فقط آن‌قدر که بچه بخواهد برگردد.
 */
export function CloudGate({ weeks, daysToNextWeek, hint }: Props) {
  const pixel = LUKORIANS.gamer;
  const [peeking, setPeeking] = useState(false);
  const timer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (weeks.length === 0) return null;

  const peek = () => {
    setPeeking(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPeeking(false), 2600);
  };

  return (
    <section
      className={`${styles.gate} ${peeking ? styles.peeking : ''}`}
      aria-label="مرحله‌های هنوز باز نشده"
    >
      {/* آنچه پشتِ ابر است: فقط یک هاله و چند سایه، بی‌هیچ جزئیاتی */}
      <div className={styles.behind} aria-hidden>
        <span className={styles.glow} />
        <span className={`${styles.silhouette} ${styles.sil1}`} />
        <span className={`${styles.silhouette} ${styles.sil2}`} />
        <span className={`${styles.silhouette} ${styles.sil3}`} />
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className={styles.spark} style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      <div className={styles.sky} aria-hidden>
        <Cloud className={styles.back} />
        <Cloud className={styles.mid} />
        <Cloud className={styles.front} />
        <Cloud className={styles.far} />
        {/* فقط روی نقشه‌ی پهن (گوشیِ خوابیده، تبلت) پیدا می‌شوند */}
        <Cloud className={styles.wideLeft} />
        <Cloud className={styles.wideRight} />
      </div>

      <button type="button" className={styles.note} onClick={peek} aria-label="یک نگاه به پشتِ ابرها">
        <span className={styles.lock} aria-hidden>
          <HiOutlineLockClosed />
        </span>
        <span className={styles.title}>مسیر پشتِ ابرها ادامه دارد</span>
        <span className={styles.text}>{peeking && hint ? hint : countdown(daysToNextWeek)}</span>
        <span className={styles.cta}>{peeking ? 'دیدی؟ فقط همین‌قدر!' : 'یه نگاه بنداز'}</span>
      </button>

      <img className={styles.pixel} src={pixel.image} alt="" aria-hidden />
    </section>
  );
}
