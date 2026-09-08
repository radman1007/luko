import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineChevronLeft, HiPlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { SEASON, seasonState } from '@/features/games/seasonData';
import { useSeasonProgress } from '@/features/games/useSeasonProgress';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';
import styles from './GameZoneCard.module.css';

/** ۳ → «۳» */
const fa = (n: number) => n.toLocaleString('fa-IR');

/**
 * دروازه‌ی دنیای بازی‌ها روی صفحه‌ی خانه.
 *
 * یک هدف دارد و بس: بچه در کمتر از یک ثانیه بفهمد کجا باید بزند.
 *
 * دو چیز از نسخه‌ی قبل عوض شد:
 *
 *   - **پیکسل بریده می‌شد.** با `bottom: -12px` داخلِ دکمه‌ای که
 *     `overflow: hidden` داشت گذاشته شده بود، پس سر و پایش می‌رفت زیرِ
 *     لبه و مثل یک برچسبِ کج‌ووج دیده می‌شد. حالا صحنه‌ی خودش را دارد و
 *     کامل می‌ایستد.
 *   - **نوارِ نقطه‌ها خوانده نمی‌شد.** هجده نقطه‌ی ریز که اغلبشان خاکستری
 *     بودند، برای بچه‌ی کلاس اول تزئین بود نه اطلاعات. حالا یک نوارِ
 *     پیشرفت است با یک جمله‌ی ساده.
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

  const next = state.nextStage;
  const percent =
    state.openStages > 0 ? Math.round((state.completedStages / state.openStages) * 100) : 0;

  const goPlay = () => navigate(next ? `/game/${next.id}` : SEASON_MAP_PATH);

  return (
    <section className={styles.zone} aria-label="تالار بازی‌ها">
      {/* ── نوارِ سیزن ─────────────────────────────────── */}
      <header className={styles.ribbon}>
        <span className={styles.season}>
          {SEASON.title}
          <b className={styles.week}>هفته‌ی {fa(state.currentWeek)}</b>
        </span>
        <span className={styles.starTally}>
          <svg className={styles.starMark} viewBox="0 0 24 24" aria-hidden focusable="false">
            <path
              fill="currentColor"
              d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95L12 2.6Z"
            />
          </svg>
          {fa(state.earnedStars)}
          <i className={styles.of}>از {fa(state.totalPossibleStars)}</i>
        </span>
      </header>

      {/* ── صحنه: بزرگ‌ترین و پررنگ‌ترین چیزِ کارت ──────── */}
      <button
        type="button"
        className={styles.hero}
        onClick={goPlay}
        aria-label={
          next
            ? `${state.completedStages > 0 ? 'ادامه‌ی' : 'شروعِ'} مرحله‌ی ${fa(next.order)}: ${next.title}`
            : 'رفتن به نقشه‌ی سیزن'
        }
      >
        {/* برقِ آرامِ روی صحنه — لایه‌ی جدا دارد تا خودِ دکمه بتواند
            بدونِ برش، کاراکتر را بیرون بدهد */}
        <span className={styles.shine} aria-hidden />

        <span className={styles.heroText}>
          <span className={styles.kicker}>
            {next ? (state.completedStages > 0 ? 'ادامه بده' : 'بزن شروع کن') : 'آفرین!'}
          </span>

          <b className={styles.heroTitle}>{next ? next.title : 'همه رو تموم کردی'}</b>

          {/* در حالتِ «همه تمام شد» چیزی این‌جا نمی‌آید: جمله‌ی زیرِ نوار
              همان «پشتِ ابر» را می‌گوید و تکرارش کارت را شلوغ می‌کرد. */}
          {next && (
            <span className={styles.heroMeta}>
              <span className={styles.stageNo}>مرحله‌ی {fa(next.order)}</span>
              <span className={styles.reward}>
                <CoinIcon size={13} aria-hidden />
                {fa(next.coinReward)}
              </span>
            </span>
          )}

          {/* دکمه‌ی صریح: بچه به شکلِ دکمه واکنش می‌دهد، نه به کارتِ
              کلیک‌پذیری که شبیهِ دکمه نیست */}
          <span className={styles.goPill} aria-hidden>
            <HiPlay />
            {next ? 'بزن بریم!' : 'نقشه رو ببین'}
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

      {/* ── پیشرفت ──────────────────────────────────────── */}
      <div className={styles.progress}>
        <div
          className={styles.bar}
          role="progressbar"
          aria-valuenow={state.completedStages}
          aria-valuemin={0}
          aria-valuemax={state.openStages}
          aria-label="مرحله‌های رفته"
        >
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </div>

        <p className={styles.note}>
          {state.completedStages === 0
            ? `${fa(state.openStages)} مرحله بازه`
            : `${fa(state.completedStages)} از ${fa(state.openStages)} مرحله رفتی`}
          {state.hiddenStages > 0 && (
            /* جداکننده عمداً «،» است نه «·»: نقطه‌ی وسط در فارسی عینِ صفر
               دیده می‌شود و «· ۱۲» را «۱۲۰» می‌خواند. */
            <span className={styles.hidden}>، {fa(state.hiddenStages)} تا پشتِ ابر</span>
          )}
        </p>

        <button
          type="button"
          className={styles.mapBtn}
          onClick={() => navigate(SEASON_MAP_PATH)}
        >
          نقشه
          <HiOutlineChevronLeft aria-hidden />
        </button>
      </div>
    </section>
  );
}
