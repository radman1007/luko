import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlineHeart, HiOutlinePlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { apiClient } from '@/lib/api';
import { isGuestMode } from '@/features/auth/guest';
import { completedLevelIds, levelById } from '@/features/books/booksData';
import { seasonState } from '@/features/games/seasonData';
import { useGrade } from '@/features/auth/useGrade';
import type { BookWorld, GameLevel } from '@/features/books/booksData';
import styles from './DailyGameCard.module.css';

/** بازی‌ای که والد برای امروزِ این بچه گذاشته (اگر گذاشته باشد) */
interface AssignedGame {
  gameSlug: string;
  gameTitle: string;
  note: string;
}

async function fetchAssignment(): Promise<AssignedGame | null> {
  const { data } = await apiClient.get('/my/assignment');
  return data.data.assignment ?? null;
}

interface DailyPick {
  book: BookWorld;
  level: GameLevel;
}

/**
 * بازیِ امروز — تاریخ‌محور انتخاب می‌شود (نه تصادفی) تا همه‌ی بچه‌ها در یک روز
 * یک بازی داشته باشند و فردا عوض شود.
 */
function gameOfTheDay(grade: number): DailyPick | null {
  // فقط از بینِ مرحله‌هایی که بچه واقعاً می‌تواند بازی کند. قبلاً از کلِ
  // فهرست انتخاب می‌شد و برای بچه‌ی تازه تقریباً همیشه یک مرحله‌ی قفل
  // درمی‌آمد — کارت باز می‌شد و بی‌آنکه چیزی بگوید به خانه برمی‌گشت.
  const state = seasonState(undefined, undefined, undefined, grade);
  const open = state.weeks
    .flatMap((week) => week.stages)
    .filter((stage) => !stage.locked)
    .map((stage) => levelById(stage.id))
    .filter((found): found is DailyPick => Boolean(found));
  if (open.length === 0) return null;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return open[dayOfYear % open.length];
}

/**
 * بلیتِ بازیِ روز — یک ضربه و بچه داخلِ بازی است.
 *
 * اگر والد از پنلِ خودش بازی‌ای برای امروز گذاشته باشد، همان نشان داده می‌شود
 * (با نشانِ «انتخابِ خانواده»)؛ وگرنه بازیِ تاریخ‌محورِ پیش‌فرض.
 */
export function DailyGameCard() {
  const navigate = useNavigate();
  const guest = isGuestMode();
  const grade = useGrade();

  const assignment = useQuery({
    queryKey: ['my-assignment'],
    queryFn: fetchAssignment,
    enabled: !guest,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const assigned = assignment.data ? levelById(assignment.data.gameSlug) : undefined;
  const pick = assigned ?? gameOfTheDay(grade);
  if (!pick) return null;

  const { book, level } = pick;
  const fromParent = Boolean(assigned);
  const note = assignment.data?.note?.trim();
  const played = completedLevelIds().has(level.id);

  return (
    <button
      type="button"
      className={styles.ticket}
      onClick={() => navigate(`/game/${level.id}`)}
      aria-label={`بازی روز: ${level.title}`}
    >
      <span className={styles.body}>
        <span className={styles.badgeRow}>
          <span className={styles.badge}>بازی روز</span>
          {fromParent && (
            <span className={styles.familyTag}>
              <HiOutlineHeart aria-hidden />
              انتخابِ خانواده
            </span>
          )}
          {played && (
            <span className={styles.playedTag}>
              <HiOutlineCheckCircle aria-hidden />
              امروز زدیش
            </span>
          )}
        </span>
        <span className={styles.title}>{level.title}</span>
        <span className={styles.world}>
          {book.worldTitle} · {book.subject}
        </span>
        {note && <span className={styles.note}>«{note}»</span>}
        <span className={styles.reward}>
          <CoinIcon size={15} aria-hidden />+{level.coinReward.toLocaleString('fa-IR')} سکه
        </span>
      </span>

      <span className={styles.perforation} aria-hidden />

      <span className={styles.stub}>
        <span className={styles.playBtn} aria-hidden>
          <HiOutlinePlay />
        </span>
        <span className={styles.stubText}>{played ? 'دوباره' : 'بزن بریم'}</span>
      </span>
    </button>
  );
}
