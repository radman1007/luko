import { HiOutlineArrowLeft, HiOutlineClock, HiOutlineCalendarDays, HiOutlinePuzzlePiece } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import type { WeeklyReport } from '../../types';
import styles from './WeeklyHero.module.css';

interface Props {
  weekly: WeeklyReport;
  childName: string;
  onDetails: () => void;
  onDaily: () => void;
}

const HIGHLIGHT_ICON = { games: HiOutlinePuzzlePiece, minutes: HiOutlineClock, days: HiOutlineCalendarDays };

/**
 * کادرِ بالای خانه: گزارشِ هفتگیِ خودکار از زبانِ «لوکی». هفته‌ی فعال فقط نقطه‌های قوت را
 * می‌گوید و به «جزئیاتِ بیشتر» می‌برد؛ هفته‌ی بی‌فعالیت دعوت می‌کند بازیِ امروز را انتخاب کنند.
 */
export function WeeklyHero({ weekly, childName, onDetails, onDaily }: Props) {
  const quiet = !weekly.active;
  return (
    <section className={styles.hero} data-quiet={quiet || undefined} aria-labelledby="weekly-title">
      <span className={styles.glow} aria-hidden />
      <img className={styles.mascot} src={LUKORIANS.luko.image} alt="" aria-hidden loading="eager" decoding="async" />

      <div className={styles.text}>
        <div className={styles.head}>
          <span className={styles.chip}>
            <span className={styles.chipLabel}>
              {quiet ? 'گزارشِ این هفته' : `گزارشِ هفتگیِ ${childName}`}
              <i aria-hidden />
            </span>
            {weekly.period}
          </span>
          <h2 id="weekly-title" className={styles.title}>{weekly.title}</h2>
        </div>
        <p className={styles.body}>{weekly.body}</p>

        {weekly.highlights.length > 0 && (
          <ul className={styles.highlights}>
            {weekly.highlights.map((item) => {
              const Icon = HIGHLIGHT_ICON[item.key];
              return (
                <li key={item.key}>
                  <span className={styles.stat}>
                    <Icon aria-hidden />
                    <b>{item.value.toLocaleString('fa-IR')}</b>
                  </span>
                  <span className={styles.statLabel}>{item.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        <div className={styles.actions}>
          {quiet ? (
            <>
              <button type="button" className={styles.primary} onClick={onDaily}>
                انتخابِ بازیِ امروز
                <HiOutlineArrowLeft aria-hidden />
              </button>
              <button type="button" className={styles.secondary} onClick={onDetails}>گزارشِ کامل</button>
            </>
          ) : (
            <button type="button" className={styles.primary} onClick={onDetails}>
              جزئیاتِ بیشتر
              <HiOutlineArrowLeft aria-hidden />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
