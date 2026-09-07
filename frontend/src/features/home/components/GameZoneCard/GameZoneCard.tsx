import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiCamera, HiLockClosed, HiOutlineChevronLeft, HiPlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { SEASON, seasonState } from '@/features/games/seasonData';
import { useSeasonProgress } from '@/features/games/useSeasonProgress';
import { StarRating } from '@/features/games/components/StarRating/StarRating';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';
import styles from './GameZoneCard.module.css';

/**
 * یک نقطه روی نوارِ کوچکِ مسیر.
 *
 * این نوار جای فهرستِ عمودیِ قبلی را گرفته که چهار ردیفِ تقریباً یک‌شکل بود
 * و سه‌تایش قفل: بچه باید می‌خواند تا بفهمد کدام را می‌تواند بزند. حالا کلِ
 * سفر در یک نگاه دیده می‌شود و ایستگاه‌های عکس هم رویش پیدایند.
 */
interface TrackDot {
  key: string;
  kind: 'stage' | 'memory';
  state: 'done' | 'current' | 'locked';
  label: string;
  stars?: number;
}

/** لحنِ پیکسل: کوتاه، چون بچه روی صفحه‌ی خانه متن نمی‌خواند */
function tease(remaining: number, started: boolean): string {
  if (!started) return 'مسیرت آماده‌ست — بپر تو!';
  if (remaining === 0) return 'همه رو زدی! حالا ستاره‌هاتو کامل کن.';
  return `${remaining.toLocaleString('fa-IR')} مرحله‌ی باز مونده`;
}

/**
 * دروازه‌ی دنیای بازی‌ها روی صفحه‌ی خانه.
 *
 * یک هدف دارد و بس: بچه در کمتر از یک ثانیه بفهمد کجا باید بزند. پس
 * بزرگ‌ترین چیزِ کارت دکمه‌ی «ادامه» است و بقیه دورش می‌چینند — نه
 * برعکس، که قبلاً بود.
 */
export function GameZoneCard() {
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const [imgFailed, setImgFailed] = useState(false);

  // از سرور می‌آید تا کارتِ خانه و نقشه یک چیز بگویند؛ ستاره‌ها هم همین‌جاست
  const progress = useSeasonProgress();
  const state = useMemo(
    () => seasonState(progress.done, new Date(), progress.stars),
    [progress],
  );

  const remaining = state.openStages - state.completedStages;
  const openStages = state.openWeeks.flatMap((week) => week.stages);
  const next = state.nextStage;

  /** نقطه‌های نوار، با «جاری»ِ یکتا */
  const track: TrackDot[] = useMemo(() => {
    const dots: TrackDot[] = [];
    openStages.forEach((stage, i) => {
      dots.push({
        key: stage.id,
        kind: 'stage',
        state: progress.done.has(stage.id)
          ? 'done'
          : stage.id === next?.id
            ? 'current'
            : 'locked',
        label: `مرحله‌ی ${stage.order.toLocaleString('fa-IR')}: ${stage.title}`,
        stars: stage.stars,
      });
      const spot = state.photoSpots.find((s) => s.afterStage === i + 1);
      if (spot) {
        dots.push({
          key: spot.id,
          kind: 'memory',
          // ایستگاه وقتی باز است که مرحله‌ی قبلش رفته باشد
          state: progress.done.has(stage.id) ? 'done' : 'locked',
          label: `ایستگاهِ یادگاری: ${spot.title}`,
        });
      }
    });
    return dots;
  }, [openStages, progress.done, next?.id, state.photoSpots]);

  const goPlay = () => {
    if (next) navigate(`/game/${next.id}`);
    else navigate(SEASON_MAP_PATH);
  };

  return (
    <section className={styles.zone} aria-label="تالار بازی‌ها">
      {/* ── نوارِ سیزن ─────────────────────────────────── */}
      <header className={styles.ribbon}>
        <span className={styles.season}>
          {SEASON.title}
          <b className={styles.week}>هفته‌ی {state.currentWeek.toLocaleString('fa-IR')}</b>
        </span>
        <span className={styles.starTally}>
          <svg className={styles.starMark} viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              fill="currentColor"
              d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6Z"
            />
          </svg>
          {state.earnedStars.toLocaleString('fa-IR')}
          <i className={styles.of}>از {state.totalPossibleStars.toLocaleString('fa-IR')}</i>
        </span>
      </header>

      {/* ── قلبِ کارت: دکمه‌ی ادامه ─────────────────────── */}
      <button type="button" className={styles.hero} onClick={goPlay}>
        <span className={styles.shine} aria-hidden />

        <span className={styles.playBtn} aria-hidden>
          <HiPlay />
        </span>

        <span className={styles.heroText}>
          <span className={styles.kicker}>
            {next ? (state.completedStages > 0 ? 'ادامه بده' : 'شروع کن') : 'آفرین!'}
          </span>
          <b className={styles.heroTitle}>{next ? next.title : 'همه رو تموم کردی'}</b>
          <span className={styles.heroMeta}>
            {next ? (
              <>
                <span className={styles.stageNo}>
                  مرحله‌ی {next.order.toLocaleString('fa-IR')}
                </span>
                <span className={styles.reward}>
                  <CoinIcon size={13} aria-hidden />
                  {next.coinReward.toLocaleString('fa-IR')}
                </span>
              </>
            ) : (
              /* متنِ «ستاره‌هاتو کامل کن» زیرِ نوارِ مسیر می‌آید؛ این‌جا
                 تکرارش می‌کرد. به‌جایش انگیزه‌ی بعدی را نشان می‌دهیم. */
              <span className={styles.stageNo}>
                {state.hiddenStages > 0
                  ? `${state.hiddenStages.toLocaleString('fa-IR')} مرحله پشتِ ابر`
                  : 'سیزن تموم شد!'}
              </span>
            )}
          </span>
        </span>

        {!imgFailed && (
          <img
            className={styles.pixel}
            src={gamer.image}
            alt=""
            aria-hidden
            loading="lazy"
            onError={() => setImgFailed(true)}
          />
        )}
      </button>

      {/* ── نوارِ کوچکِ مسیر ─────────────────────────────── */}
      <div className={styles.trackWrap}>
        <ol className={styles.track} aria-label="مسیرِ سیزن">
          {track.map((dot) => (
            <li
              key={dot.key}
              className={`${styles.dot} ${styles[dot.kind]} ${styles[dot.state]}`}
              title={dot.label}
            >
              <span className={styles.srOnly}>{dot.label}</span>
              {dot.kind === 'memory' ? (
                <HiCamera aria-hidden />
              ) : dot.state === 'locked' ? (
                <HiLockClosed aria-hidden />
              ) : dot.state === 'current' ? (
                <HiPlay aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
        <p className={styles.trackNote}>
          {tease(remaining, state.completedStages > 0)}
          {state.hiddenStages > 0 && (
            /* جداکننده عمداً «،» است نه «·»: نقطه‌ی وسط در فارسی عینِ صفر
               دیده می‌شود و «· ۱۲» را «۱۲۰» می‌خواند. */
            <span className={styles.hidden}>
              ، {state.hiddenStages.toLocaleString('fa-IR')} تا هم پشتِ ابره
            </span>
          )}
        </p>
      </div>

      {/* ── ستاره‌های آخرین مرحله‌ها + راهِ نقشه ────────── */}
      <div className={styles.footer}>
        {state.completedStages > 0 && state.earnedStars < state.totalPossibleStars && (
          <span className={styles.replay}>
            <StarRating earned={0} max={3} />
            ستاره‌های بیشتری منتظرتن
          </span>
        )}
        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => navigate(SEASON_MAP_PATH)}
        >
          نقشه‌ی کامل
          <HiOutlineChevronLeft aria-hidden />
        </button>
      </div>
    </section>
  );
}
