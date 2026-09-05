import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineBolt,
  HiOutlineCheck,
  HiOutlineChevronLeft,
  HiOutlineLockClosed,
  HiOutlinePlay,
} from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { completedLevelIds } from '@/features/books/booksData';
import { SEASON, seasonState } from '@/features/games/seasonData';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';
import styles from './GameZoneCard.module.css';

/** لحن پیکسل: گیمری، کل‌کلی ولی رفیق */
function teaseText(completed: number, remaining: number): string {
  if (completed === 0) {
    return 'مرحله‌های این هفته باز شدن و تو هنوز شروع نکردی؟! کنترلرت خاک گرفت رفیق.';
  }
  if (remaining === 0) {
    return 'مرحله‌های بازشده رو تموم کردی! تا ابرها کنار برن، رکوردهاتو بهتر کن.';
  }
  return `${remaining.toLocaleString('fa-IR')} مرحله‌ی باز مونده — تا هفته‌ی بعد وقت داری تمومشون کنی!`;
}

/** تالار بازی‌ها — مسیرِ سیزن؛ مرحله‌های همین هفته و ابرهای هفته‌ی بعد */
export function GameZoneCard() {
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const [imgFailed, setImgFailed] = useState(false);

  const done = completedLevelIds();
  const state = seasonState(done);
  const remaining = state.openStages - state.completedStages;
  const percent =
    state.openStages > 0 ? Math.round((state.completedStages / state.openStages) * 100) : 0;
  // مرحله‌های همین هفته روی کارت می‌آیند؛ اگر مرحله‌ی بعدیِ بچه از هفته‌ی قبل
  // مانده باشد، همان اول فهرست می‌نشیند تا کارت هیچ‌وقت بی‌«الان» نماند
  const thisWeek = state.weeks.find((week) => week.index === state.currentWeek);
  const weekStages = thisWeek?.stages ?? [];
  const cardStages =
    state.nextStage && !weekStages.some((stage) => stage.id === state.nextStage?.id)
      ? [state.nextStage, ...weekStages]
      : weekStages;

  return (
    <section className={styles.card} aria-label="تالار بازی‌ها">
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
          <p className={styles.speaker}>
            {gamer.name}، {gamer.role}
          </p>
          <p className={styles.text}>{teaseText(state.completedStages, remaining)}</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          <HiOutlineBolt aria-hidden />
          تالار بازی‌ها
        </h2>
        <span className={styles.seasonBadge}>
          {SEASON.title} · هفته‌ی {state.currentWeek.toLocaleString('fa-IR')}
        </span>
      </div>

      <div className={styles.progressRow}>
        <span className={styles.progressText}>
          {state.completedStages.toLocaleString('fa-IR')} از{' '}
          {state.openStages.toLocaleString('fa-IR')} مرحله‌ی بازشده
        </span>
        <span className={styles.coins}>
          <CoinIcon size={14} aria-hidden />
          {state.coinsEarned.toLocaleString('fa-IR')}
        </span>
      </div>
      <div className={styles.track} aria-hidden>
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>

      {cardStages.length > 0 && (
        <ul className={styles.stages}>
          {cardStages.map((stage) => {
            const isDone = done.has(stage.id);
            const isNext = stage.id === state.nextStage?.id;

            return (
              <li key={stage.id}>
                <button
                  type="button"
                  className={
                    isNext
                      ? styles.stageNext
                      : isDone
                        ? styles.stageDone
                        : stage.locked
                          ? styles.stageLocked
                          : styles.stage
                  }
                  // مرحله‌ی قفل نباید به صفحه‌ی بازی برود؛ آن‌جا فقط
                  // برمی‌گشت و بچه فکر می‌کرد بازی خراب است.
                  onClick={() =>
                    navigate(stage.locked ? SEASON_MAP_PATH : `/game/${stage.id}`, {
                      state: stage.locked
                        ? { reason: 'اول باید مرحله‌های قبلی رو تموم کنی!' }
                        : undefined,
                    })
                  }
                  aria-disabled={stage.locked}
                >
                  <span className={styles.stageOrder} aria-hidden>
                    {stage.order.toLocaleString('fa-IR')}
                  </span>
                  <span className={styles.stageTexts}>
                    <b className={styles.stageTitle}>{stage.title}</b>
                    <span className={styles.stageSubject}>
                      {stage.subject}
                      {isNext && <> · <span className={styles.nowTag}>الان نوبتِ توئه</span></>}
                    </span>
                  </span>
                  <span className={styles.stageIcon} aria-hidden>
                    {isDone ? <HiOutlineCheck /> : stage.locked ? <HiOutlineLockClosed /> : <HiOutlinePlay />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {state.cloudedWeeks.length > 0 && (
        <div className={styles.cloudRow}>
          <span className={styles.cloudIcon} aria-hidden>
            <HiOutlineLockClosed />
          </span>
          <p className={styles.cloudText}>
            {state.hiddenStages.toLocaleString('fa-IR')} مرحله پشتِ ابرهاست
            {state.daysToNextWeek !== undefined &&
              (state.daysToNextWeek === 0
                ? ' — امروز باز می‌شود'
                : ` — ${state.daysToNextWeek.toLocaleString('fa-IR')} روز دیگر`)}
          </p>
        </div>
      )}

      <button type="button" className={styles.allBtn} onClick={() => navigate('/books')}>
        رفتن به مسیرِ سیزن
        <HiOutlineChevronLeft aria-hidden />
      </button>

      <p className={styles.rewardHint}>
        <CoinIcon size={15} aria-hidden />
        جایزه‌ی هر مرحله: سکه‌ی شهر لوکو
      </p>
    </section>
  );
}
