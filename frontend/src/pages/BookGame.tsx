import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineChevronRight, HiOutlineCheckCircle, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { levelById, markLevelCompleted } from '@/features/books/booksData';
import styles from './BookGame.module.css';

/**
 * اجرای بازیِ یک مرحله. بازی یک فایل HTML مستقل در public است که داخل iframe
 * (sandbox) بارگذاری می‌شود. اگر مرحله بازی نداشته باشد، «به‌زودی» نمایش داده می‌شود.
 */
export default function BookGame() {
  const navigate = useNavigate();
  const { gameId = '' } = useParams();
  const gamer = LUKORIANS.gamer;
  const found = levelById(gameId);

  const [justWon, setJustWon] = useState(false);

  const backToMap = () => navigate(found ? `/book/${found.book.id}` : '/books');

  const finish = () => {
    if (!found) return;
    markLevelCompleted(found.level.id);
    setJustWon(true);
  };

  // آماده برای آینده: بازی‌هایی که خودشان پایانِ بازی را اعلام می‌کنند
  useEffect(() => {
    if (!found?.level.gameFile) return;
    const onMessage = (e: MessageEvent) => {
      // فقط پیام‌های هم‌ریشه (بازیِ داخل iframe) پذیرفته می‌شوند
      if (e.origin !== window.location.origin) return;
      if (e.data && e.data.type === 'luko-game-complete') finish();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found?.level.id]);

  if (!found) {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <button type="button" className={styles.back} onClick={() => navigate('/books')} aria-label="بازگشت">
            <HiOutlineChevronRight />
          </button>
          <span className={styles.topTitle}>بازی پیدا نشد</span>
        </header>
      </main>
    );
  }

  const { book, level } = found;
  const hasGame = Boolean(level.gameFile);

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button type="button" className={styles.back} onClick={backToMap} aria-label="بازگشت به نقشه">
          <HiOutlineChevronRight />
        </button>
        <div className={styles.topTexts}>
          <span className={styles.topLevel}>
            مرحله {level.order.toLocaleString('fa-IR')}: {level.title}
          </span>
          <span className={styles.topWorld}>{book.worldTitle}</span>
        </div>
        {hasGame && (
          <span className={styles.reward}>
            <CoinIcon size={14} aria-hidden />
            {level.coinReward.toLocaleString('fa-IR')}
          </span>
        )}
      </header>

      {hasGame ? (
        <div className={styles.stage}>
          <iframe
            className={styles.frame}
            src={level.gameFile}
            title={level.title}
            sandbox="allow-scripts allow-same-origin"
            allow="autoplay; fullscreen"
          />
          <div className={styles.actions}>
            <button type="button" className={styles.doneBtn} onClick={finish} disabled={justWon}>
              <HiOutlineCheckCircle aria-hidden />
              {justWon ? 'ثبت شد! آفرین' : 'این مرحله رو تموم کردم'}
            </button>
          </div>

          {justWon && (
            <div className={styles.winOverlay} role="dialog" aria-label="مرحله کامل شد">
              <div className={styles.winCard}>
                <img className={styles.winChar} src={gamer.image} alt={gamer.name} />
                <p className={styles.winTitle}>ایول! این مرحله رو بردی!</p>
                <p className={styles.winCoins}>
                  <CoinIcon size={18} aria-hidden />+{level.coinReward.toLocaleString('fa-IR')} سکه
                </p>
                <button type="button" className={styles.winBtn} onClick={backToMap}>
                  برگرد به نقشه
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.soon}>
          <span className={styles.soonIcon} aria-hidden>
            <HiOutlineWrenchScrewdriver />
          </span>
          <p className={styles.soonTitle}>بازیِ این مرحله به‌زودی می‌رسه!</p>
          <p className={styles.soonDesc}>
            {gamer.name} داره این بازی رو می‌سازه؛ زود برمی‌گردیم که بترکونیش!
          </p>
          <button type="button" className={styles.soonBtn} onClick={backToMap}>
            برگرد به نقشه
          </button>
        </div>
      )}
    </main>
  );
}
