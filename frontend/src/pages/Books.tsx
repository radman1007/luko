import { useNavigate } from 'react-router-dom';
import {
  HiOutlineBolt,
  HiOutlineCheckCircle,
  HiOutlineChevronLeft,
  HiOutlineRectangleStack,
  HiOutlineSquares2X2,
} from 'react-icons/hi2';
import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import {
  BOOKS,
  GRADE_LABEL,
  bookProgress,
  completedLevelIds,
  overallStats,
} from '@/features/books/booksData';
import styles from './Books.module.css';

const GUIDE_STEPS = [
  'اینجا اتاقِ کتاب‌های منه، رفیق! همه‌ی دنیاهای بازی یه‌جا جمع‌ان.',
  'بالای صفحه ببین چند مرحله رو زدی و چند تا سکه جمع کردی — بعد بپر تو هر کتاب!',
  'هر کتاب یه مسیرِ پله‌پله‌ست؛ مرحله‌ها رو یکی‌یکی رد کن تا قهرمانش بشی!',
];

export default function Books() {
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const done = completedLevelIds();
  const stats = overallStats(done);

  const tease =
    stats.completedLevels === 0
      ? 'هنوز صفرِ صفری! بیا اولین مرحله رو با هم بترکونیم.'
      : `${stats.completedLevels.toLocaleString('fa-IR')} مرحله رو زدی، ${stats.remainingLevels.toLocaleString('fa-IR')} تا مونده — جا نزنی!`;

  const statTiles = [
    { label: 'کتاب‌ها', value: stats.totalBooks, icon: <HiOutlineRectangleStack size={20} /> },
    { label: 'مرحله تمومه', value: stats.completedLevels, icon: <HiOutlineCheckCircle size={20} /> },
    { label: 'مرحله مونده', value: stats.remainingLevels, icon: <HiOutlineSquares2X2 size={20} /> },
    { label: 'سکه', value: stats.coinsEarned, icon: <CoinIcon size={20} /> },
  ];

  return (
    <StudentLayout className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.head}>
          <img className={styles.character} src={gamer.image} alt={gamer.name} />
          <div className={styles.bubble}>
            <p className={styles.speaker}>{gamer.name}، {gamer.role}</p>
            <p className={styles.text}>{tease}</p>
            <span className={styles.tail} aria-hidden />
          </div>
        </div>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <HiOutlineBolt aria-hidden />
            کتاب‌ها و مراحل
          </h1>
          <span className={styles.gradeBadge}>{GRADE_LABEL}</span>
        </div>
      </header>

      <div className={styles.statsGrid}>
        {statTiles.map((tile) => (
          <div key={tile.label} className={styles.statTile}>
            <span className={styles.statIcon} aria-hidden>
              {tile.icon}
            </span>
            <span className={styles.statValue}>{tile.value.toLocaleString('fa-IR')}</span>
            <span className={styles.statLabel}>{tile.label}</span>
          </div>
        ))}
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressTop}>
          <span className={styles.progressLabel}>پیشرفتِ کلیِ تو</span>
          <span className={styles.progressPercent}>
            {stats.totalLevels > 0
              ? Math.round((stats.completedLevels / stats.totalLevels) * 100).toLocaleString('fa-IR')
              : '۰'}
            ٪
          </span>
        </div>
        <div className={styles.progressTrack} aria-hidden>
          <span
            className={styles.progressFill}
            style={{
              width: `${stats.totalLevels > 0 ? (stats.completedLevels / stats.totalLevels) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <div className={styles.list}>
        {BOOKS.map((book) => {
          const prog = bookProgress(book, done);
          const ready = book.levels.length > 0;
          const current = prog.levels.find((l) => l.status === 'current');
          const finished = ready && prog.completedCount === prog.total;

          return (
            <button
              key={book.id}
              type="button"
              className={`${styles.book} ${!ready ? styles.locked : ''}`}
              onClick={() => navigate(`/book/${book.id}`)}
            >
              <span className={styles.bookIcon} aria-hidden>
                <book.icon />
              </span>

              <span className={styles.bookBody}>
                <span className={styles.bookTitleRow}>
                  <span className={styles.bookWorld}>{book.worldTitle}</span>
                  <span className={styles.bookSubject}>{book.title}</span>
                </span>

                {ready ? (
                  <>
                    <span className={styles.bookTrack} aria-hidden>
                      <span className={styles.bookFill} style={{ width: `${prog.percent}%` }} />
                    </span>
                    <span className={styles.bookMeta}>
                      <span className={styles.metaLevels}>
                        {prog.completedCount.toLocaleString('fa-IR')}/
                        {prog.total.toLocaleString('fa-IR')} مرحله
                      </span>
                      <span className={styles.metaCoins}>
                        <CoinIcon size={13} aria-hidden />
                        {prog.coinsEarned.toLocaleString('fa-IR')}
                      </span>
                      <span className={styles.metaStatus}>
                        {finished
                          ? 'تمومش کردی! ⚡'
                          : `الان: مرحله ${current?.order.toLocaleString('fa-IR')}`}
                      </span>
                    </span>
                  </>
                ) : (
                  <span className={styles.soonBadge}>این دنیا به‌زودی باز می‌شه</span>
                )}
              </span>

              <HiOutlineChevronLeft className={styles.chevron} aria-hidden />
            </button>
          );
        })}
      </div>

      <CharacterGuide character={gamer} steps={GUIDE_STEPS} storageKey="books-intro" />
    </StudentLayout>
  );
}
