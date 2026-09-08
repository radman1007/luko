import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HiOutlineChevronRight, HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import { CoinIcon, DewIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { levelById, markLevelCompleted } from '@/features/books/booksData';
import { seasonState } from '@/features/games/seasonData';
import { useGrade } from '@/features/auth/useGrade';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew, grantFertilizer } from '@/features/garden/store';
import { completeGame, flushEvents, trackEvent } from '@/features/games/telemetry';
import { gamesApi } from '@/features/games/api';
import { StarRating } from '@/features/games/components/StarRating/StarRating';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';
import { completeMission } from '@/features/club/store';
import styles from './BookGame.module.css';

/**
 * اجرای بازیِ یک مرحله. بازی یک فایل HTML مستقل در public است که داخل iframe
 * (sandbox) بارگذاری می‌شود. اگر مرحله بازی نداشته باشد، «به‌زودی» نمایش داده می‌شود.
 *
 * تمام‌شدن **خودکار** است: خودِ بازی با `LUKO.finish()` پیام می‌دهد و همین‌جا
 * ثبت می‌شود. دکمه‌ی دستیِ «تموم کردم» عمداً برداشته شده — بچه نباید بتواند
 * بدونِ بردنِ بازی مرحله را ببندد و سکه بگیرد.
 */
export default function BookGame() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { gameId = '' } = useParams();
  const gamer = LUKORIANS.gamer;
  const found = levelById(gameId);

  // مسیرِ سیزن پشتِ‌سرهم است؛ تایپ کردنِ آدرسِ یک مرحله‌ی قفل هم نباید بازش
  // کند. مرحله‌های خارج از مسیر (بازیِ بخش‌های دیگر) شرطی ندارند.
  const grade = useGrade();
  const locked = useMemo(
    () =>
      seasonState(undefined, undefined, undefined, grade)
        .weeks.flatMap((week) => week.stages)
        .find((stage) => stage.id === gameId)?.locked ?? false,
    [gameId, grade],
  );

  /**
   * آدرسِ فایلِ بازی از سرور می‌آید و امضا دارد. مسیرِ ثابتِ فایل دیگر
   * مستقیم باز نمی‌شود، پس تا این نیامده iframe ساخته نمی‌شود.
   */
  const play = useQuery({
    queryKey: ['games', 'play-link', gameId],
    queryFn: () => gamesApi.playLink(gameId),
    enabled: Boolean(found?.level.gameFile) && !locked,
    // لینک کوتاه‌عمر است؛ با برگشتن به بازی باید تازه گرفته شود
    staleTime: 0,
    gcTime: 0,
    // خطای ۴xx (مثلاً «مهمانی و این مرحله رایگان نیست») با تکرار درست
    // نمی‌شود؛ تکرارش فقط کاربر را پشتِ «در حال باز کردن» نگه می‌داشت.
    retry: (count, error) => {
      const code = (error as AxiosError).response?.status ?? 0;
      return code >= 500 && count < 1;
    },
  });

  /**
   * مهمان فقط مرحله‌ی اول را رایگان دارد؛ سرور برای بقیه ۴۰۱ می‌دهد.
   * آن‌وقت به‌جای صفحه‌ی خطا، خودش به ورود می‌رود با پیامی که می‌گوید چرا.
   */
  const playStatus = (play.error as AxiosError | undefined)?.response?.status;
  const needsAccount = playStatus === 401;
  // ۴۰۳ یعنی سرور این مرحله را هنوز قفل می‌داند. بدونِ این، بچه روی
  // «بازی باز نشد» می‌ماند و نمی‌فهمد باید اول مرحله‌ی قبلی را برود.
  const serverLocked = playStatus === 403;
  useEffect(() => {
    if (needsAccount) {
      navigate('/login', {
        replace: true,
        state: { reason: 'برای ادامه‌ی بازی‌ها وارد شو — بقیه‌ی مرحله‌ها منتظرتن!' },
      });
      return;
    }
    if (serverLocked) {
      navigate(SEASON_MAP_PATH, {
        replace: true,
        state: { reason: 'اول باید مرحله‌های قبلی رو تموم کنی!' },
      });
    }
  }, [needsAccount, serverLocked, navigate]);

  const [justWon, setJustWon] = useState(false);
  const [serverCoins, setServerCoins] = useState<number | null>(null);
  const [wonStars, setWonStars] = useState<number>(0);
  const rewardedRef = useRef(false);

  // همیشه به مسیرِ سیزن برمی‌گردیم؛ نقشه‌ی کتابیِ قدیمی دیگر مقصدِ برگشت نیست
  const backToMap = () => navigate(SEASON_MAP_PATH);

  /**
   * ستاره‌ی همین اجرا، از خلاصه‌ای که خودِ بازی با `LUKO.finish({ stars })`
   * فرستاده. عددِ خارج از بازه بی‌صدا رد می‌شود — سرور هم دوباره سقف
   * می‌زند، ولی نباید اصلاً چیزِ بی‌معنی بفرستیم.
   */
  const finish = (stars?: number) => {
    if (!found || rewardedRef.current) return;
    rewardedRef.current = true;
    markLevelCompleted(found.level.id);
    completeMission('game');   // مأموریتِ روزانه‌ی «یه بازی رو کامل کن»
    // پاداشِ محلی بلافاصله نشان داده می‌شود تا بچه منتظرِ شبکه نماند
    grantDew(DEW_REWARD.game, 'game');
    grantFertilizer(1);
    setJustWon(true);

    // ثبتِ سرورمحور: سکه و گنج را سرور می‌دهد و گزارشِ والد از همین‌جا ساخته می‌شود
    void (async () => {
      await flushEvents();
      try {
        const result = await completeGame(found.level.id, stars);
        if (result && !result.alreadyDone) setServerCoins(result.coins);
        if (result) setWonStars(result.stars);
        // سرور مرجعِ قفلِ مسیر است؛ بدونِ این، نقشه با فهرستِ کهنه باز می‌شود
        // و مرحله‌ای که همین الان تمام شد «نرفته» نشان داده می‌شود.
        await queryClient.invalidateQueries({ queryKey: ['games', 'completed'] });
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
        const raw = (data.summary as { stars?: unknown } | undefined)?.stars;
        const stars = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
          ? Math.round(raw)
          : undefined;
        finish(stars);
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

  if (locked) {
    return (
      <Navigate
        to={SEASON_MAP_PATH}
        replace
        state={{ reason: 'اول باید مرحله‌های قبلی رو تموم کنی!' }}
      />
    );
  }

  if (!found) {
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <button type="button" className={styles.back} onClick={backToMap} aria-label="بازگشت">
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
          {play.data ? (
            <iframe
              className={styles.frame}
              src={play.data}
              title={level.title}
              sandbox="allow-scripts allow-same-origin"
              allow="autoplay; fullscreen"
            />
          ) : (
            <div className={styles.loading}>
              {play.isError ? 'بازی باز نشد. یک‌بار دیگر امتحان کن.' : 'در حال باز کردنِ بازی…'}
            </div>
          )}
          {justWon && (
            <div className={styles.winOverlay} role="dialog" aria-label="مرحله کامل شد">
              <div className={styles.winCard}>
                <img className={styles.winChar} src={gamer.image} alt={gamer.name} />
                <p className={styles.winTitle}>ایول! این مرحله رو بردی!</p>
                {/* ستاره را همین‌جا نشان می‌دهیم: اگر بچه تا نقشه صبر کند،
                    ارتباطِ «چه کردم» با «چه گرفتم» را از دست می‌دهد. */}
                {wonStars > 0 && (
                  <span className={styles.winStars}>
                    <StarRating earned={wonStars} max={3} size="md" />
                  </span>
                )}
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
