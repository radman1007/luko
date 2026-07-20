import { useNavigate, useParams } from 'react-router-dom';
import {
  HiOutlineChevronRight,
  HiOutlineCheck,
  HiOutlineFlag,
  HiOutlineLockClosed,
  HiOutlinePlay,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { bookById, bookProgress, completedLevelIds } from '@/features/books/booksData';
import type { LevelWithStatus } from '@/features/books/booksData';
import styles from './BookGames.module.css';

const GUIDE_STEPS = [
  'خب رفیق، این نقشه‌ی راهته! از پایینِ نقشه شروع کن و پله‌پله برو بالا.',
  'مرحله‌های سبز رو زدی، مرحله‌ی درخشان همون‌جاییه که الان باید بترکونی!',
  'قفلی‌ها رو باید بازِشون کنی؛ هر مرحله‌ای که ببری، بعدی باز می‌شه و سکه می‌گیری!',
];

// پارامترهای مسیر مارپیچی (در مختصات SVG)
const CX = 150;
const AMP = 70;
const TOP = 60;
const STEP = 120;
const BOTTOM_PAD = 70;

function nodeX(i: number): number {
  return CX + AMP * Math.sin(i * 0.9 + 0.4);
}
function nodeY(i: number): number {
  return TOP + i * STEP;
}

/** مسیرِ صافِ عمودی-موج‌دار بین نقطه‌ها */
function toPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midY = p0.y + (p1.y - p0.y) / 2;
    d += ` C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export default function BookGames() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const book = bookById(id);

  if (!book) {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.back}
            onClick={() => navigate('/books')}
            aria-label="بازگشت"
          >
            <HiOutlineChevronRight />
          </button>
          <span className={styles.topTitle}>کتاب پیدا نشد</span>
        </header>
      </main>
    );
  }

  const done = completedLevelIds();
  const prog = bookProgress(book, done);
  const ready = book.levels.length > 0;

  const points = prog.levels.map((_, i) => ({ x: nodeX(i), y: nodeY(i) }));
  const height = ready ? TOP + (prog.levels.length - 1) * STEP + BOTTOM_PAD : 0;
  const basePath = toPath(points);
  // مسیرِ روشن تا مرحله‌ی فعلی (نقاطِ تمام‌شده + خودِ مرحله‌ی فعلی)
  const litPath = toPath(points.slice(0, Math.min(points.length, prog.completedCount + 1)));

  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  const openLevel = (level: LevelWithStatus) => {
    if (level.status === 'locked') return;
    navigate(`/game/${level.id}`);
  };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button
          type="button"
          className={styles.back}
          onClick={() => navigate('/books')}
          aria-label="بازگشت به کتاب‌ها"
        >
          <HiOutlineChevronRight />
        </button>
        <div className={styles.topTexts}>
          <span className={styles.topWorld}>{book.worldTitle}</span>
          <span className={styles.topSubject}>{book.title}</span>
        </div>
        <span className={styles.topIcon} aria-hidden>
          <book.icon />
        </span>
      </header>

      {/* حباب کمیک‌بوکیِ گیمر */}
      <div className={styles.intro}>
        <img className={styles.character} src={gamer.image} alt={gamer.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{gamer.name}</p>
          <p className={styles.text}>
            {ready
              ? prog.completedCount === prog.total
                ? 'کلِ این دنیا رو فتح کردی! دمت گرم قهرمان!'
                : `${prog.completedCount.toLocaleString('fa-IR')} مرحله رو زدی، ${(prog.total - prog.completedCount).toLocaleString('fa-IR')} تا مونده. بزن بریم بعدی!`
              : 'این دنیا هنوز ساخته نشده رفیق؛ ولی به‌زودی می‌ترکونیمش!'}
          </p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      {ready ? (
        <>
          {/* نوار خلاصه‌ی پیشرفت این کتاب */}
          <div className={styles.summary}>
            <span className={styles.sumItem}>
              <b>{prog.completedCount.toLocaleString('fa-IR')}</b>/
              {prog.total.toLocaleString('fa-IR')} مرحله
            </span>
            <span className={styles.sumItem}>
              <CoinIcon size={14} aria-hidden />
              <b>{prog.coinsEarned.toLocaleString('fa-IR')}</b> سکه
            </span>
            <span className={styles.sumItem}>
              <b>{prog.percent.toLocaleString('fa-IR')}٪</b> کامل
            </span>
          </div>

          {/* نقشه‌ی مارپیچیِ مراحل */}
          <div className={styles.trail} style={{ ['--trail-h' as string]: `${height}` }}>
            <svg
              className={styles.trailSvg}
              viewBox={`0 0 300 ${height}`}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <path className={styles.pathBase} d={basePath} />
              {litPath && <path className={styles.pathLit} d={litPath} />}
            </svg>

            {/* پرچمِ شروع */}
            {startPoint && (
              <span
                className={styles.startFlag}
                style={{
                  left: `${(startPoint.x / 300) * 100}%`,
                  top: `${((startPoint.y - 42) / height) * 100}%`,
                }}
              >
                <HiOutlineFlag aria-hidden />
                شروع
              </span>
            )}

            {prog.levels.map((level, i) => {
              const p = points[i];
              return (
                <div
                  key={level.id}
                  className={styles.node}
                  style={{ left: `${(p.x / 300) * 100}%`, top: `${(p.y / height) * 100}%` }}
                >
                  {level.status === 'current' && (
                    <span className={styles.hereBadge}>الان اینجایی!</span>
                  )}
                  <button
                    type="button"
                    className={`${styles.circle} ${styles[level.status]}`}
                    onClick={() => openLevel(level)}
                    disabled={level.status === 'locked'}
                    aria-label={`مرحله ${level.order}: ${level.title}`}
                  >
                    {level.status === 'completed' ? (
                      <HiOutlineCheck className={styles.circleIcon} aria-hidden />
                    ) : level.status === 'locked' ? (
                      <HiOutlineLockClosed className={styles.circleIcon} aria-hidden />
                    ) : (
                      <HiOutlinePlay className={styles.circleIcon} aria-hidden />
                    )}
                    <span className={styles.circleNum}>{level.order.toLocaleString('fa-IR')}</span>
                  </button>
                  <span className={styles.caption}>
                    <span className={styles.capTitle}>{level.title}</span>
                    <span className={styles.capCoin}>
                      <CoinIcon size={12} aria-hidden />
                      {level.coinReward.toLocaleString('fa-IR')}
                    </span>
                  </span>
                </div>
              );
            })}

            {/* جامِ پایان */}
            {endPoint && (
              <span
                className={`${styles.finish} ${prog.completedCount === prog.total ? styles.finishWon : ''}`}
                style={{
                  left: `${(endPoint.x / 300) * 100}%`,
                  top: `${((endPoint.y + 66) / height) * 100}%`,
                }}
              >
                <HiOutlineTrophy aria-hidden />
              </span>
            )}
          </div>
        </>
      ) : (
        <div className={styles.soon}>
          <span className={styles.soonIcon} aria-hidden>
            <book.icon />
          </span>
          <p className={styles.soonTitle}>این دنیا به‌زودی باز می‌شه!</p>
          <p className={styles.soonDesc}>
            مرحله‌های «{book.worldTitle}» تو راهه؛ زود برمی‌گردیم سراغش!
          </p>
          <button type="button" className={styles.soonBtn} onClick={() => navigate('/books')}>
            بقیه‌ی کتاب‌ها
          </button>
        </div>
      )}

      <CharacterGuide
        character={gamer}
        steps={ready ? GUIDE_STEPS : []}
        storageKey={`book-map-${book.id}`}
      />
    </main>
  );
}
