import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { AxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { HiOutlineChevronRight, HiOutlineCloudArrowUp, HiOutlineMapPin } from 'react-icons/hi2';
import { CoinIcon, DewIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { completedLevelIds, markLevelCompleted } from '@/features/games/localProgress';
import { SEASON, seasonState } from '@/features/games/seasonData';
import { useGamePath } from '@/features/games/useGamePath';
import { useGrade } from '@/features/auth/useGrade';
import { DEW_REWARD } from '@/features/garden/gardenData';
import { grantDew, grantFertilizer } from '@/features/garden/store';
import { flushEvents, trackEvent } from '@/features/games/telemetry';
import {
  flushCompletions,
  isPendingCompletion,
  markCompletionGranted,
  queueCompletion,
} from '@/features/games/pendingCompletions';
import { gamesApi } from '@/features/games/api';
import { StarRating } from '@/features/games/components/StarRating/StarRating';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';
import { completeMission, grantCoins, syncCoins } from '@/features/club/store';
import { isGuestMode } from '@/features/auth/guest';
import styles from './BookGame.module.css';

/**
 * اجرای بازیِ یک مرحله. بازی یک فایل HTML مستقل در public است که داخل iframe
 * (sandbox) بارگذاری می‌شود. مرحله از مسیرِ کلاسِ بچه (سرور) پیدا می‌شود.
 *
 * تمام‌شدن **خودکار** است: خودِ بازی با `LUKO.finish()` پیام می‌دهد و همین‌جا
 * ثبت می‌شود. دکمه‌ی دستیِ «تموم کردم» عمداً برداشته شده — بچه نباید بتواند
 * بدونِ بردنِ بازی مرحله را ببندد و سکه بگیرد.
 */
/** بعد از این مدت بازی، دکمه‌ی «تموم کردم» ظاهر می‌شود (میلی‌ثانیه) */
const CLAIM_AFTER_MS = 3 * 60 * 1000;

export default function BookGame() {
  const navigate = useNavigate();
  const { gameId = '' } = useParams();
  const gamer = LUKORIANS.gamer;

  // مسیرِ سیزن پشتِ‌سرهم است؛ تایپ کردنِ آدرسِ یک مرحله‌ی قفل هم نباید بازش کند
  const grade = useGrade();
  const path = useGamePath(grade);
  const stage = useMemo(
    () =>
      seasonState(path.stages)
        .weeks.flatMap((week) => week.stages)
        .find((item) => item.id === gameId),
    [path.stages, gameId],
  );
  const locked = stage?.locked ?? false;

  /**
   * آدرسِ فایلِ بازی از سرور می‌آید و امضا دارد. مسیرِ ثابتِ فایل دیگر
   * مستقیم باز نمی‌شود، پس تا این نیامده iframe ساخته نمی‌شود.
   */
  const play = useQuery({
    queryKey: ['games', 'play-link', gameId],
    queryFn: () => gamesApi.playLink(gameId),
    enabled: Boolean(stage) && !locked,
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

  /**
   * تورِ ایمنی: بعضی بازی‌های استودیو پایانشان را خبر نمی‌دهند و پل هم
   * همیشه نمی‌تواند صفحه‌ی بُردشان را تشخیص دهد. بدونِ این دکمه، بچه‌ای که
   * بازی را برده پشتِ همان مرحله می‌ماند و کلِ مسیرش قفل می‌شود. فقط بعد از
   * چند دقیقه بازیِ واقعی ظاهر می‌شود، نه از همان اول.
   */
  const [canClaim, setCanClaim] = useState(false);
  const [justWon, setJustWon] = useState(false);
  /**
   * سکه‌ای که همین مرحله واقعاً به کیف اضافه کرد. تکرارِ مرحله‌ی بُرده‌شده
   * سکه ندارد و پیامِ «+۱۰ سکه» آن‌جا دروغ بود — حالا که سکه‌ی بازی و اپ یکی
   * است، عددِ روی کیف باید با همین پیام بخواند.
   */
  const [wonCoins, setWonCoins] = useState<number | null>(null);
  const [wonStars, setWonStars] = useState<number>(0);
  /** بی‌اینترنت برده شد: در صف است و با برگشتنِ اینترنت ثبت می‌شود */
  const [savedOffline, setSavedOffline] = useState(false);
  const rewardedRef = useRef(false);

  // همیشه به مسیرِ سیزن برمی‌گردیم؛ نقشه‌ی کتابیِ قدیمی دیگر مقصدِ برگشت نیست
  const backToMap = () => navigate(SEASON_MAP_PATH);

  /**
   * ستاره‌ی همین اجرا، از خلاصه‌ای که خودِ بازی با `LUKO.finish({ stars })`
   * فرستاده. عددِ خارج از بازه بی‌صدا رد می‌شود — سرور هم دوباره سقف
   * می‌زند، ولی نباید اصلاً چیزِ بی‌معنی بفرستیم.
   */
  const finish = (stars?: number) => {
    if (!stage || rewardedRef.current) return;
    rewardedRef.current = true;
    const firstTime = !completedLevelIds().has(stage.id);
    markLevelCompleted(stage.id);
    // مهمان حسابِ سروری ندارد؛ سکه‌ی بارِ اولِ مرحله همین‌جا به کیف می‌رود
    if (isGuestMode()) {
      const coins = firstTime ? stage.coinReward : 0;
      grantCoins(coins);
      setWonCoins(coins);
    }
    completeMission('game');   // مأموریتِ روزانه‌ی «یه بازی رو کامل کن»
    // پاداشِ محلی بلافاصله نشان داده می‌شود تا بچه منتظرِ شبکه نماند
    grantDew(DEW_REWARD.game, 'game');
    grantFertilizer(1);
    setJustWon(true);

    if (isGuestMode()) return;

    // ثبتِ سرورمحور: سکه و گنج را سرور می‌دهد و گزارشِ والد از همین‌جا ساخته می‌شود.
    // از راهِ صف می‌رود تا اگر اینترنت نبود (یا مرحله‌های آفلاینِ قبلی هنوز
    // نرسیده‌اند) چیزی گم نشود و ترتیبِ پشتِ‌سرهم برای سرور حفظ شود.
    queueCompletion(stage.id, stars);
    // رویدادها و تکمیل به هم وابسته نیستند؛ روی اینترنتِ کندِ گوشی، منتظرِ
    // رویدادها ماندن جایزه‌ی مرحله را چند ثانیه دیرتر نشان می‌داد
    void flushEvents();
    void (async () => {
      const results = await flushCompletions(stage.id);
      const result = results.get(stage.id);
      if (result) {
        // سکه را سرور می‌دهد؛ همان عدد روی کیفی که صفحه‌ی اصلی و بازی‌ها نشان می‌دهند
        const coins = result.alreadyDone ? 0 : result.coins;
        grantCoins(coins);
        setWonCoins(coins);
        setWonStars(result.stars);
        return;
      }
      if (isPendingCompletion(stage.id)) {
        // اینترنت نیست: جایزه همین حالا، ثبت با برگشتنِ اینترنت (بی‌سکه‌ی دوباره)
        const coins = firstTime ? stage.coinReward : 0;
        markCompletionGranted(stage.id, coins);
        grantCoins(coins);
        setWonCoins(coins);
        setWonStars(stars ?? 0);
        setSavedOffline(true);
      }
      // وگرنه سرور صریحاً ردش کرد (مثلاً مرحله‌ی حذف‌شده): سکه‌ای در کار نیست
    })();
  };

  useEffect(() => {
    if (!play.data || justWon) return undefined;
    const timer = window.setTimeout(() => setCanClaim(true), CLAIM_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [play.data, justWon]);

  // پلِ بازی ← اپ: پایانِ بازی، و تله‌متری‌ای که گزارشِ والدین از رویش ساخته می‌شود
  useEffect(() => {
    if (!stage) return undefined;
    const slug = stage.id;

    const onMessage = (e: MessageEvent) => {
      // فقط پیام‌های هم‌ریشه (بازیِ داخل iframe) پذیرفته می‌شوند
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        event?: Record<string, unknown>;
        summary?: Record<string, unknown>;
        coins?: unknown;
      };
      if (!data?.type) return;

      // کیفِ مشترکِ بازی (luko-wallet.js): خرید یا جایزه‌ی داخلِ بازی روی سکه‌ی اصلی
      if (data.type === 'luko-coins') {
        if (typeof data.coins === 'number' && Number.isInteger(data.coins) && data.coins >= 0) {
          syncCoins(data.coins);
        }
        return;
      }

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
  }, [stage?.id]);

  if (locked) {
    return (
      <Navigate
        to={SEASON_MAP_PATH}
        replace
        state={{ reason: 'اول باید مرحله‌های قبلی رو تموم کنی!' }}
      />
    );
  }

  if (!stage) {
    const waiting = path.isLoading;
    return (
      <main className={styles.page}>
        <header className={styles.topbar}>
          <button type="button" className={styles.back} onClick={backToMap} aria-label="بازگشت">
            <HiOutlineChevronRight />
          </button>
          <span className={styles.topTitle}>{waiting ? 'در حال باز کردن…' : 'بازی پیدا نشد'}</span>
        </header>
        {!waiting && (
          <div className={styles.soon}>
            <span className={styles.soonIcon} aria-hidden>
              <HiOutlineMapPin />
            </span>
            <p className={styles.soonTitle}>
              {path.isError ? 'مسیر باز نشد!' : 'این مرحله توی مسیرِ تو نیست.'}
            </p>
            <p className={styles.soonDesc}>
              {path.isError
                ? 'اینترنت رو چک کن و یه‌بار دیگه امتحان کن.'
                : `${gamer.name} می‌گه از روی نقشه برو سراغِ مرحله‌ی بعدیت.`}
            </p>
            <button type="button" className={styles.soonBtn} onClick={backToMap}>
              برگرد به مسیرِ سیزن
            </button>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <button type="button" className={styles.back} onClick={backToMap} aria-label="بازگشت به مسیرِ سیزن">
          <HiOutlineChevronRight />
        </button>
        <div className={styles.topTexts}>
          <span className={styles.topLevel}>
            مرحله {stage.order.toLocaleString('fa-IR')}: {stage.title}
          </span>
          <span className={styles.topWorld}>
            {SEASON.title} · هفته‌ی {stage.week.toLocaleString('fa-IR')}
          </span>
        </div>
        <span className={styles.reward}>
          <CoinIcon size={14} aria-hidden />
          {stage.coinReward.toLocaleString('fa-IR')}
        </span>
      </header>

      <div className={styles.stage}>
        {play.data ? (
          <iframe
            className={styles.frame}
            src={play.data}
            title={stage.title}
            sandbox="allow-scripts allow-same-origin"
            allow="autoplay; fullscreen"
          />
        ) : (
          <div className={styles.loading}>
            {play.isError ? 'بازی باز نشد. یک‌بار دیگر امتحان کن.' : 'در حال باز کردنِ بازی…'}
          </div>
        )}
        {canClaim && !justWon && (
          <button type="button" className={styles.claim} onClick={() => finish()}>
            این مرحله رو تموم کردم
          </button>
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
                  <StarRating earned={wonStars} max={stage.maxStars} size="md" />
                </span>
              )}
              {/* تا جوابِ سرور نیامده چیزی نمی‌گوییم؛ عدد باید همانی باشد که به کیف رفت */}
              {wonCoins !== null && wonCoins > 0 && (
                <p className={styles.winCoins}>
                  <CoinIcon size={18} aria-hidden />+{wonCoins.toLocaleString('fa-IR')} سکه
                </p>
              )}
              {wonCoins === 0 && <p className={styles.winDew}>سکه‌ی این مرحله رو قبلاً گرفته بودی</p>}
              {savedOffline && (
                <p className={styles.winDew}>
                  <HiOutlineCloudArrowUp aria-hidden />
                  {/* اینترنت هست ولی سرور همین حالا جواب نداد: «بی‌اینترنت» دروغ بود */}
                  {navigator.onLine === false
                    ? 'بی‌اینترنت بازی کردی؛ وقتی اینترنت وصل شد خودش ثبت می‌شه'
                    : 'بُردت ذخیره شد؛ چند لحظه‌ی دیگه خودش ثبت می‌شه'}
                </p>
              )}
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
    </main>
  );
}
