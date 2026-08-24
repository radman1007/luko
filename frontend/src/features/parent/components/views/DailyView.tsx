import { useState } from 'react';
import {
  HiOutlineCheck,
  HiOutlineCheckBadge,
  HiOutlineClock,
  HiOutlineLockClosed,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { CoinIcon, GamepadIcon } from '@/components/ui/icons';
import type { Assignment } from '../../api';
import type { Suggestion } from '../../types';
import { Card } from '../shell/Card';
import styles from './DailyView.module.css';

interface Props {
  childName: string;
  suggestions: Suggestion[];
  currentSlug: string | null;
  assignments: Assignment[];
  saving: boolean;
  onPick: (suggestion: Suggestion, date: string) => void;
}

/** تاریخِ محلی (نه UTC) — وگرنه بعد از ظهر، «امروز» به فردا می‌افتد */
function isoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** بازی روز — پیشنهادِ هوشمند + انتخابِ دستی برای امروز یا فردا */
export function DailyView({
  childName,
  suggestions,
  currentSlug,
  assignments,
  saving,
  onPick,
}: Props) {
  const [dayOffset, setDayOffset] = useState(0);
  const date = isoDate(dayOffset);
  const top = suggestions[0];
  const assignment = assignments.find((row) => row.date === date);
  const selectedSlug = dayOffset === 0 ? (assignment?.gameSlug ?? currentSlug) : assignment?.gameSlug ?? null;

  if (!top) {
    return (
      <Card icon={GamepadIcon} title="بازی روز" note="هنوز بازی‌ای برای پیشنهاد نداریم.">
        <p className={styles.empty}>
          به‌محضِ اینکه بازی‌ها روی حسابِ {childName} فعال شوند، پیشنهادِ روزانه اینجا ساخته می‌شود.
        </p>
      </Card>
    );
  }

  return (
    <>
      <section className={styles.hero}>
        <span className={styles.tag}>
          <HiOutlineSparkles aria-hidden />
          پیشنهاد هوشمند این هفته
        </span>
        <h2>بازی «{top.title}»</h2>
        <p>{top.why}</p>
        <div className={styles.heroMeta}>
          <span className={styles.heroChip}>
            <HiOutlineCheckBadge aria-hidden />
            مبحث: {top.topic || top.subject || '—'}
          </span>
          <span className={styles.heroChip}>
            <HiOutlineClock aria-hidden />
            حدود {top.minutes.toLocaleString('fa-IR')} دقیقه
          </span>
        </div>
        <button
          type="button"
          className={styles.cta}
          disabled={saving || selectedSlug === top.slug}
          onClick={() => onPick(top, date)}
        >
          <HiOutlineCheck aria-hidden />
          {selectedSlug === top.slug ? 'همین حالا ثبت شده' : 'ثبت به‌عنوان بازی روز'}
        </button>
      </section>

      <div className={styles.days}>
        <button
          type="button"
          className={dayOffset === 0 ? styles.dayActive : styles.day}
          onClick={() => setDayOffset(0)}
        >
          امروز
        </button>
        <button
          type="button"
          className={dayOffset === 1 ? styles.dayActive : styles.day}
          onClick={() => setDayOffset(1)}
        >
          فردا
        </button>
      </div>

      {assignment && (
        <p className={styles.current}>
          <HiOutlineCheckBadge aria-hidden />
          بازی {dayOffset === 0 ? 'امروزِ' : 'فردایِ'} {childName}: «{assignment.gameTitle}»
          {assignment.played && <b> — انجام شد</b>}
        </p>
      )}

      <Card
        icon={GamepadIcon}
        title="یا یکی از این بازی‌ها"
        note={`بازی انتخابی روی صفحهٔ خانهٔ ${childName} نشان داده می‌شود.`}
      >
        {suggestions.map((suggestion) => {
          const selected = selectedSlug === suggestion.slug;
          return (
            <button
              key={suggestion.slug}
              type="button"
              className={selected ? styles.pickSel : styles.pick}
              disabled={saving}
              onClick={() => onPick(suggestion, date)}
            >
              <span className={styles.pickIcon} aria-hidden>
                <GamepadIcon />
              </span>
              <span className={styles.pickMain}>
                <b>{suggestion.title}</b>
                {/* دلیلِ کامل بالای صفحه آمده؛ اینجا فقط مشخصاتِ کوتاه تا ردیف‌ها شلوغ نشوند */}
                <small>
                  {suggestion.topic || suggestion.subject || suggestion.bookTitle} · حدود{' '}
                  {suggestion.minutes.toLocaleString('fa-IR')} دقیقه
                </small>
                <span className={styles.pickCoins}>
                  <CoinIcon size={12} aria-hidden />
                  {suggestion.coinReward.toLocaleString('fa-IR')} سکه
                  {suggestion.played && <span className={styles.playedTag}>قبلاً بازی کرده</span>}
                </span>
              </span>
              <span className={styles.radio} aria-hidden>
                <HiOutlineCheck />
              </span>
            </button>
          );
        })}

        <p className={styles.privacy}>
          <HiOutlineLockClosed aria-hidden />
          <span>
            با ثبتِ بازی روز، مسیرِ تمرینِ {childName} هدفمند می‌شود و روی ضعیف‌ترین مبحثش تمرکز
            می‌کند.
          </span>
        </p>
      </Card>
    </>
  );
}
