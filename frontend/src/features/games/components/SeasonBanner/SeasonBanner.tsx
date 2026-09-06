import { HiOutlineClock, HiOutlineSparkles } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { SEASON } from '../../seasonData';
import type { SeasonState } from '../../seasonData';
import styles from './SeasonBanner.module.css';

interface Props {
  state: SeasonState;
}

/** سردرِ سیزن: شماره‌ی سیزن، هفته‌ی جاری، نوارِ هفته‌ها و شمارشِ معکوسِ هفته‌ی بعد */
export function SeasonBanner({ state }: Props) {
  const percent =
    state.openStages > 0 ? Math.round((state.completedStages / state.openStages) * 100) : 0;

  return (
    <section className={styles.banner} aria-label="وضعیت سیزن">
      <div className={styles.top}>
        <div className={styles.titles}>
          <span className={styles.badge}>
            <HiOutlineSparkles aria-hidden />
            {SEASON.title}
          </span>
          <h2 className={styles.name}>{SEASON.subtitle}</h2>
        </div>
        <span className={styles.weekNow}>
          هفته‌ی {state.currentWeek.toLocaleString('fa-IR')}
          <span className={styles.weekTotal}>از {state.totalWeeks.toLocaleString('fa-IR')}</span>
        </span>
      </div>

      {/* نوارِ هفته‌ها — هفته‌های نرسیده عمداً بی‌شماره‌اند تا لو نروند */}
      <ol className={styles.weeks}>
        {state.weeks.map((week) => (
          <li
            key={week.index}
            className={
              week.state === 'done'
                ? styles.weekDone
                : week.state === 'current'
                  ? styles.weekCurrent
                  : week.state === 'past'
                    ? styles.weekPast
                    : styles.weekLocked
            }
            title={week.state === 'locked' ? 'هنوز باز نشده' : week.label}
          >
            {week.state === 'locked' ? '؟' : week.index.toLocaleString('fa-IR')}
          </li>
        ))}
      </ol>

      {/* ستاره‌ها معیارِ اصلی‌اند: «چندتا رفتم» را «چقدر خوب رفتم» کامل می‌کند */}
      <div className={styles.starRow}>
        <span className={styles.starLead}>
          {/* یک ستاره‌ی تزئینی، نه امتیاز: سه ستاره‌ی پر کنارِ «۰ از ۴۵»
              متناقض خوانده می‌شد. */}
          <svg className={styles.starMark} viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              fill="currentColor"
              d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6Z"
            />
          </svg>
          <b className={styles.starCount}>
            {state.earnedStars.toLocaleString('fa-IR')}
            <span className={styles.starTotal}>
              {' '}از {state.totalPossibleStars.toLocaleString('fa-IR')}
            </span>
          </b>
        </span>
        <span className={styles.coins}>
          <CoinIcon size={14} aria-hidden />
          {state.coinsEarned.toLocaleString('fa-IR')}
        </span>
      </div>
      <div
        className={styles.starTrack}
        role="progressbar"
        aria-valuenow={state.earnedStars}
        aria-valuemin={0}
        aria-valuemax={state.totalPossibleStars}
        aria-label="ستاره‌های گرفته‌شده‌ی سیزن"
      >
        <span className={styles.starFill} style={{ width: `${state.starPercent}%` }} />
      </div>

      <div className={styles.progressRow}>
        <span className={styles.progressText}>
          {state.completedStages.toLocaleString('fa-IR')} از{' '}
          {state.openStages.toLocaleString('fa-IR')} مرحله‌ی بازشده
        </span>
        <span className={styles.progressText}>
          {percent.toLocaleString('fa-IR')}٪
        </span>
      </div>
      <div className={styles.track} aria-hidden>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>

      {state.daysToNextWeek !== undefined && (
        <p className={styles.countdown}>
          <HiOutlineClock aria-hidden />
          {state.daysToNextWeek === 0
            ? 'مرحله‌های تازه همین امروز باز می‌شوند!'
            : `${state.daysToNextWeek.toLocaleString('fa-IR')} روز تا بازشدنِ مرحله‌های تازه`}
        </p>
      )}
    </section>
  );
}
