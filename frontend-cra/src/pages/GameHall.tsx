import { useNavigate } from 'react-router-dom';
import { HiOutlineBolt, HiOutlinePlay } from 'react-icons/hi2';
import { StudentLayout } from 'components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from 'components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from 'lib/characters';
import { GRADE_LABEL, completedLevelIds } from 'features/books/booksData';
import { seasonState } from 'features/games/seasonData';
import { SeasonBanner } from 'features/games/components/SeasonBanner/SeasonBanner';
import { StagePath } from 'features/games/components/StagePath/StagePath';
import { CloudGate } from 'features/games/components/CloudGate/CloudGate';
import styles from './GameHall.module.css';

const GUIDE_STEPS = [
  'خوش اومدی به تالارِ بازی‌ها! اینجا دیگه خبری از کتاب نیست — یه مسیرِ سیزنیه.',
  'هر هفته یه دسته مرحله‌ی تازه برات باز می‌شه؛ بقیه‌ش پشتِ ابرهاست و هنوز نباید ببینیش.',
  'از مرحله‌ی درخشان شروع کن، سکه‌شو بگیر و برو سراغِ بعدی. هفته‌ی دیگه ابرها کنار می‌رن!',
];

/** لحنِ پیکسل: گیمری و کل‌کلی */
function tease(completed: number, remaining: number, finishedWeek: boolean): string {
  if (completed === 0) {
    return 'مسیرِ سیزن باز شد و تو هنوز تکون نخوردی! بزن بریم ببینم چند مَرده حلاجی.';
  }
  if (finishedWeek) {
    return 'کلِ مرحله‌های این هفته رو زدی! حالا باید صبر کنی ابرها کنار برن — منم منتظرم.';
  }
  return `${completed.toLocaleString('fa-IR')} مرحله رفتی، ${remaining.toLocaleString('fa-IR')} تا از مرحله‌های بازشده مونده. جا نزنی!`;
}

/** تالار بازی‌ها — صفحه‌ی اولِ مسیرِ سیزن */
export default function GameHall() {
  const navigate = useNavigate();
  const gamer = LUKORIANS.gamer;
  const done = completedLevelIds();
  const state = seasonState(done);

  const remaining = state.openStages - state.completedStages;
  const weekDone = remaining === 0 && state.openStages > 0;

  return (
    <StudentLayout className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.head}>
          <img className={styles.character} src={gamer.image} alt={gamer.name} />
          <div className={styles.bubble}>
            <p className={styles.speaker}>
              {gamer.name}، {gamer.role}
            </p>
            <p className={styles.text}>{tease(state.completedStages, remaining, weekDone)}</p>
            <span className={styles.tail} aria-hidden />
          </div>
        </div>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <HiOutlineBolt aria-hidden />
            تالار بازی‌ها
          </h1>
          <span className={styles.gradeBadge}>{GRADE_LABEL}</span>
        </div>
      </header>

      <SeasonBanner state={state} />

      {state.nextStage && (
        <button
          type="button"
          className={styles.resume}
          onClick={() => navigate(`/game/${state.nextStage?.id}`)}
        >
          <span className={styles.resumeIcon} aria-hidden>
            <HiOutlinePlay />
          </span>
          <span className={styles.resumeTexts}>
            <span className={styles.resumeLabel}>ادامه بده از</span>
            <b className={styles.resumeTitle}>
              مرحله‌ی {state.nextStage.order.toLocaleString('fa-IR')} — {state.nextStage.title}
            </b>
          </span>
        </button>
      )}

      {weekDone && (
        <p className={styles.weekCleared}>
          مرحله‌های بازشده تمام شد! تا هفته‌ی بعد می‌توانی هرکدام را دوباره بازی کنی.
        </p>
      )}

      {/* ابرها سقفِ مسیرند: هرچه بالاتر، هفته‌ی نرسیده‌تر */}
      <CloudGate weeks={state.cloudedWeeks} daysToNextWeek={state.daysToNextWeek} />

      <StagePath
        weeks={state.openWeeks}
        done={done}
        nextStageId={state.nextStage?.id}
        onPlay={(stage) => navigate(`/game/${stage.id}`)}
      />

      {state.seasonFinished && (
        <p className={styles.seasonEnd}>
          کلِ سیزن را تمام کردی! سیزنِ بعدی با مرحله‌های تازه در راه است.
        </p>
      )}

      <CharacterGuide character={gamer} steps={GUIDE_STEPS} storageKey="game-hall-season" />
    </StudentLayout>
  );
}
