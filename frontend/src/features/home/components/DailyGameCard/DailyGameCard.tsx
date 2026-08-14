import { useNavigate } from 'react-router-dom';
import { HiOutlineCheckCircle, HiOutlinePlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { BOOKS, completedLevelIds } from '@/features/books/booksData';
import type { BookWorld, GameLevel } from '@/features/books/booksData';
import styles from './DailyGameCard.module.css';

interface DailyPick {
  book: BookWorld;
  level: GameLevel;
}

/**
 * بازیِ امروز — تاریخ‌محور انتخاب می‌شود (نه تصادفی) تا همه‌ی بچه‌ها در یک روز
 * یک بازی داشته باشند و فردا عوض شود.
 */
function gameOfTheDay(): DailyPick | null {
  const playable = BOOKS.flatMap((book) =>
    book.levels.filter((level) => level.gameFile).map((level) => ({ book, level })),
  );
  if (playable.length === 0) return null;

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86_400_000);
  return playable[dayOfYear % playable.length];
}

/** بلیتِ بازیِ روز — یک ضربه و بچه داخلِ بازی است */
export function DailyGameCard() {
  const navigate = useNavigate();
  const pick = gameOfTheDay();
  if (!pick) return null;

  const { book, level } = pick;
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
