import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiOutlineChevronRight, HiOutlineCheckCircle, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { CoinIcon, DewIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { levelById, markLevelCompleted } from '@/features/books/booksData';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew, grantFertilizer } from '@/features/garden/store';
import { completeGame, flushEvents, trackEvent } from '@/features/games/telemetry';
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
  const [serverCoins, setServerCoins] = useState<number | null>(null);
  const rewardedRef = useRef(false);

  // همیشه به مسیرِ سیزن برمی‌گردیم؛ نقشه‌ی کتابیِ قدیمی دیگر مقصدِ برگشت نیست
  const backToMap = () => navigate('/books');

  const finish = () => {
    if (!found || rewardedRef.current) return;
    rewardedRef.current = true;
    markLevelCompleted(found.level.id);
    // پاداشِ محلی بلافاصله نشان داده می‌شود تا بچه منتظرِ شبکه نماند
    grantDew(DEW_REWARD.game, 'game');
    grantFertilizer(1);
    setJustWon(true);

    // ثبتِ سرورمحور: سکه و گنج را سرور می‌دهد و گزارشِ والد از همین‌جا ساخته می‌شود
    void (async () => {
      await flushEvents();
      try {
        const result = await completeGame(found.level.id);
        if (result && !result.alreadyDone) setServerCoins(result.coins);
      } catch {
        // اگر شبکه قطع بود، تکمیلِ محلی سرِ جایش می‌ماند و دفعهٔ بعد همگام می‌شود
      }
    })();
  };

  // پلِ بازی ← اپ: پایانِ بازی، و تله‌متری‌ای که گزارشِ والدین از رویش ساخته می‌شود
  useEffect(() => {
    if (!found?.level.gameFile) return undefined;
    const slug = found.level.id;

    const onMessage = (e: MessageEvent) => {
      // فقط پیام‌های هم‌ریشه (بازیِ داخل iframe) پذیرفته می‌شوند
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; event?: Record<string, unknown>; summary?: Record<string, unknown> };
      if (!data?.type) return;

      if (data.type === 'luko-game-event' && data.event) {
        const { type, ...rest } = data.event as { type?: string };
        if (type) trackEvent({ gameSlug: slug, eventType: type, payload: rest });
        return;
      }

      if (data.type === 'luko-game-complete') {
        trackEvent({ gameSlug: slug, eventType: 'game_complete', payload: data.summary ?? {} });
        finish();
        return;
      }

      if (data.type === 'luko-game-progress') {
        // بچه وسطِ کار بیرون رفته — همین هم برای گزارش ارزش دارد
        trackEvent({ gameSlug: slug, eventType: 'game_end', payload: data.summary ?? {} });
        void flushEvents(true);
      }
    };

    const onLeave = () => void flushEvents(true);

    window.addEventListener('message', onMessage);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pagehide', onLeave);
      void flushEvents();          // خروج از صفحه‌ی بازی هم بافر را خالی می‌کند
    };
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
        <button type="button" className={styles.back} onClick={backToMap} aria-label="بازگشت به مسیرِ سیزن">
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
                  <CoinIcon size={18} aria-hidden />+
                  {(serverCoins ?? level.coinReward).toLocaleString('fa-IR')} سکه
                </p>
                <p className={styles.winDew}>
                  <DewIcon size={16} aria-hidden />+{DEW_REWARD.game.toLocaleString('fa-IR')} شبنم و یک کود برای باغچه
                </p>
                <button type="button" className={styles.winBtn} onClick={backToMap}>
                  برگرد به مسیرِ سیزن
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
            برگرد به مسیرِ سیزن
          </button>
        </div>
      )}
    </main>
  );
}
