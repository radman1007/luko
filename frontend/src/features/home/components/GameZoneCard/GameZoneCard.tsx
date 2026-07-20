import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineBolt, HiOutlineChevronLeft, HiOutlinePlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { MOCK_BOOKS } from '../../mockData';
import styles from './GameZoneCard.module.css';

// TODO: پایه‌ی تحصیلی بعد از آماده شدن بک‌اند از پروفایل کاربر می‌آید
const GRADE_LABEL = 'کلاس اول';

function completedGames(): string[] {
  try {
    const raw = localStorage.getItem('luko_completed_games');
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    /* داده‌ی خراب → لیست خالی */
  }
  return [];
}

/** لحن پیکسل: گیمری، کل‌کلی ولی رفیق */
function teaseText(totalDone: number): string {
  if (totalDone === 0) {
    return 'هنوز هیچ مرحله‌ای رو رد نکردی؟! کنترلرت خاک گرفت رفیق... بزن بریم ببینم چند مَرده حلاجی!';
  }
  return `لِوِل ${totalDone.toLocaleString('fa-IR')}؟ بدک نیست... ولی تا رکورد من کلی مونده. جرئت داری ادامه بده!`;
}

/** گیم‌زون — تمام کتاب‌های پایه در قالب دنیاهای بازی */
export function GameZoneCard() {
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const [imgFailed, setImgFailed] = useState(false);
  const done = completedGames();

  return (
    <section className={styles.card} aria-label="گیم‌زون لوکو">
      <div className={styles.head}>
        {!imgFailed && (
          <img
            className={styles.character}
            src={gamer.image}
            alt={gamer.name}
            onError={() => setImgFailed(true)}
          />
        )}
        <div className={styles.bubble}>
          <p className={styles.speaker}>{gamer.name}، {gamer.role}</p>
          <p className={styles.text}>{teaseText(done.length)}</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          <HiOutlineBolt aria-hidden />
          گیم‌زون لوکو
        </h2>
        <span className={styles.gradeBadge}>{GRADE_LABEL}</span>
      </div>
      <p className={styles.desc}>
        هر درس یه دنیاست، هر تمرین یه مرحله؛ رد کنی، سکه مال توئه!
      </p>

      <div className={styles.grid}>
        {MOCK_BOOKS.map((book) => {
          const doneCount = done.filter((id) => id.startsWith(book.id)).length;
          const ready = book.gamesCount > 0;
          const finished = ready && doneCount >= book.gamesCount;
          // مرحله‌ای که کاربر الان باید بازی کند (بعدیِ کامل‌نشده)
          const nextLevel = Math.min(doneCount + 1, book.gamesCount);
          const percent = ready ? Math.round((doneCount / book.gamesCount) * 100) : 0;

          return (
            <button
              key={book.id}
              type="button"
              className={`${styles.world} ${!ready ? styles.locked : ''}`}
              onClick={() => navigate(`/book/${book.id}`)}
            >
              <span className={styles.worldIcon} aria-hidden>
                <book.icon />
              </span>
              <span className={styles.worldTitle}>{book.worldTitle}</span>
              <span className={styles.worldSubject}>{book.title}</span>

              {ready && (
                <span className={styles.progressTrack} aria-hidden>
                  <span className={styles.progressFill} style={{ width: `${percent}%` }} />
                </span>
              )}

              <span className={styles.worldFooter}>
                {!ready ? (
                  <span className={styles.soonBadge}>بازی‌ش به‌زودی می‌رسه</span>
                ) : finished ? (
                  <span className={styles.finished}>تمومش کردی! ⚡</span>
                ) : (
                  <span className={styles.nextLevel}>
                    الان: مرحله {nextLevel.toLocaleString('fa-IR')}
                  </span>
                )}
                <span className={styles.playChip} aria-hidden>
                  <HiOutlinePlay />
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className={styles.allBtn} onClick={() => navigate('/books')}>
        همه‌ی کتاب‌ها و مراحل
        <HiOutlineChevronLeft aria-hidden />
      </button>

      <p className={styles.rewardHint}>
        <CoinIcon size={15} aria-hidden />
        جایزه‌ی هر مرحله: سکه‌ی شهر لوکو
      </p>
    </section>
  );
}
