import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HiOutlineBolt } from 'react-icons/hi2';
import { StudentLayout } from '@/components/layout/StudentLayout/StudentLayout';
import { CharacterGuide } from '@/components/characters/CharacterGuide/CharacterGuide';
import { LUKORIANS } from '@/lib/characters';
import { gradeName } from '@/lib/grades';
import { SEASON, seasonState } from '@/features/games/seasonData';
import type { PhotoSpot } from '@/features/games/seasonData';
import { useGamePath } from '@/features/games/useGamePath';
import { useSeasonProgress } from '@/features/games/useSeasonProgress';
import { useGrade } from '@/features/auth/useGrade';
import { SeasonBanner } from '@/features/games/components/SeasonBanner/SeasonBanner';
import { SeasonMap } from '@/features/games/components/SeasonMap/SeasonMap';
import { MemoryCamera } from '@/features/games/components/MemoryCamera/MemoryCamera';
import { useDeleteMemory, useMemories, useSaveMemory } from '@/features/games/useMemories';
import { isGuestMode } from '@/features/auth/guest';
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
  // پیشرفت از سرور می‌آید تا قفلِ نقشه با قفلِ سرور یکی باشد
  const progress = useSeasonProgress();
  const grade = useGrade();
  const path = useGamePath(grade);
  const state = useMemo(
    () => seasonState(path.stages, progress.done, new Date(), progress.stars),
    [path.stages, progress],
  );

  // یادگاری‌ها: نقشه فقط بندانگشتی می‌گیرد تا سبک بماند
  const guest = isGuestMode();
  const { bySpot } = useMemories(SEASON.id);
  const saveMemory = useSaveMemory(SEASON.id);
  const deleteMemory = useDeleteMemory(SEASON.id);
  const [openSpot, setOpenSpot] = useState<PhotoSpot | null>(null);
  const memoryThumbs = useMemo(
    () => new Map([...bySpot].map(([spotId, memory]) => [spotId, memory.thumbnail])),
    [bySpot],
  );

  const remaining = state.openStages - state.completedStages;
  const weekDone = remaining === 0 && state.openStages > 0;
  // وقتی بچه از یک مرحله‌ی قفل به این‌جا برگردانده می‌شود، باید بفهمد چرا
  const reason = (useLocation().state as { reason?: string } | null)?.reason;

  return (
    <StudentLayout className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.head}>
          <img className={styles.character} src={gamer.image} alt={gamer.name} />
          <div className={styles.bubble}>
            <p className={styles.speaker}>
              {gamer.name}، {gamer.role}
            </p>
            <p className={styles.text}>
              {reason ?? tease(state.completedStages, remaining, weekDone)}
            </p>
            <span className={styles.tail} aria-hidden />
          </div>
        </div>

        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            <HiOutlineBolt aria-hidden />
            تالار بازی‌ها
          </h1>
          <span className={styles.gradeBadge}>{gradeName(grade)}</span>
        </div>
      </header>

      {/* پایه‌ای که هنوز بازی ندارد نباید نقشه‌ی خالی ببیند — و قطعاً
          نباید بازی‌های پایه‌ی دیگر را ببیند. */}
      {path.isLoading ? (
        <section className={styles.soon} aria-busy="true" aria-label="در حال آماده‌کردنِ مسیر">
          <p className={styles.soonText}>{gamer.name} داره مسیرت رو آماده می‌کنه…</p>
        </section>
      ) : path.isError ? (
        <section className={styles.soon} aria-label="مسیر باز نشد">
          <h2 className={styles.soonTitle}>مسیر باز نشد!</h2>
          <p className={styles.soonText}>اینترنت رو چک کن و یه‌بار دیگه امتحان کن.</p>
          <button type="button" className={styles.retry} onClick={path.retry}>
            دوباره امتحان کن
          </button>
        </section>
      ) : state.totalStages === 0 ? (
        <section className={styles.soon} aria-label="بازی‌های این پایه">
          <img className={styles.soonChar} src={gamer.image} alt="" aria-hidden />
          <h2 className={styles.soonTitle}>بازی‌های {gradeName(grade)} تو راهن!</h2>
          <p className={styles.soonText}>
            داریم برات می‌سازیمشون. تا اون موقع می‌تونی سراغِ باغچه، کلاب و
            پادکست بری — اون‌ها همین حالا آماده‌ن.
          </p>
        </section>
      ) : (
        <>
      <SeasonBanner state={state} />

      {weekDone && (
        <p className={styles.weekCleared}>
          مرحله‌های بازشده تمام شد! تا هفته‌ی بعد می‌توانی هرکدام را دوباره بازی کنی.
        </p>
      )}

      <SeasonMap
        openWeeks={state.openWeeks}
        cloudedWeeks={state.cloudedWeeks}
        daysToNextWeek={state.daysToNextWeek}
        done={progress.done}
        currentStage={state.nextStage}
        onPlay={(stage) => navigate(`/game/${stage.id}`)}
        photoSpots={state.photoSpots}
        memoryThumbs={memoryThumbs}
        onOpenSpot={(spot) =>
          // مهمان حسابِ سروری ندارد و ذخیره‌ی عکسش ۴۰۱ می‌گیرد؛ به‌جای
          // بازکردنِ دوربینی که آخرش شکست می‌خورد، همان‌جا دعوتش می‌کنیم.
          guest
            ? navigate('/login', {
                state: { reason: 'برای نگه‌داشتنِ عکسِ یادگاری اول وارد شو!' },
              })
            : setOpenSpot(spot)
        }
        theme={SEASON.theme}
      />

      {state.seasonFinished && (
        <p className={styles.seasonEnd}>
          کلِ سیزن را تمام کردی! سیزنِ بعدی با مرحله‌های تازه در راه است.
        </p>
      )}
        </>
      )}

      {openSpot && (
        <MemoryCamera
          spot={openSpot}
          existing={bySpot.get(openSpot.id)?.thumbnail}
          saving={saveMemory.isPending}
          onClose={() => setOpenSpot(null)}
          onSave={(photo) =>
            saveMemory.mutate(
              { seasonId: SEASON.id, spotId: openSpot.id, ...photo },
              { onSuccess: () => setOpenSpot(null) },
            )
          }
          onDelete={
            bySpot.has(openSpot.id)
              ? () =>
                  deleteMemory.mutate(bySpot.get(openSpot.id)!.id, {
                    onSuccess: () => setOpenSpot(null),
                  })
              : undefined
          }
        />
      )}

      <CharacterGuide character={gamer} steps={GUIDE_STEPS} storageKey="game-hall-season" />
    </StudentLayout>
  );
}
