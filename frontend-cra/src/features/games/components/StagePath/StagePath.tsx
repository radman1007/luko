import type { IconType } from 'react-icons';
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineCalculator,
  HiOutlineCheck,
  HiOutlinePencil,
  HiOutlinePlay,
  HiOutlinePuzzlePiece,
} from 'react-icons/hi2';
import { CoinIcon } from 'components/ui/icons';
import type { SeasonStage, SeasonWeek, SubjectKey } from '../../seasonData';
import styles from './StagePath.module.css';

interface Props {
  weeks: SeasonWeek[];
  done: Set<string>;
  nextStageId?: string;
  onPlay: (stage: SeasonStage) => void;
}

const SUBJECT_ICON: Record<SubjectKey, IconType> = {
  math: HiOutlineCalculator,
  science: HiOutlineBeaker,
  writing: HiOutlinePencil,
  quran: HiOutlineBookOpen,
  reading: HiOutlineBookOpen,
  other: HiOutlinePuzzlePiece,
};

const SUBJECT_CLASS: Record<SubjectKey, string> = {
  math: styles.subjMath,
  science: styles.subjScience,
  writing: styles.subjWriting,
  quran: styles.subjQuran,
  reading: styles.subjReading,
  other: styles.subjOther,
};

const WEEK_NOTE: Record<SeasonWeek['state'], string> = {
  done: 'کاملش کردی',
  current: 'این هفته',
  past: 'هنوز نصفه‌کاره',
  locked: '',
};

/**
 * مسیرِ مارپیچِ مرحله‌های بازشده — از **پایین به بالا**:
 * مرحله‌ی ۱ کفِ مسیر است و هرچه بالاتر می‌روی، هفته‌ی جلوتر.
 * برای همین هفته‌ها و مرحله‌های داخلشان وارونه رندر می‌شوند و
 * برچسبِ هفته زیرِ گروهِ خودش می‌نشیند (شروعِ آن هفته).
 */
export function StagePath({ weeks, done, nextStageId, onPlay }: Props) {
  return (
    <div className={styles.track}>
      {[...weeks].reverse().map((week) => (
        <section key={week.index} className={styles.week}>
          <ol className={styles.stages}>
            {[...week.stages].reverse().map((stage) => {
              const isDone = done.has(stage.id);
              const isNext = stage.id === nextStageId;
              const Icon = SUBJECT_ICON[stage.subjectKey];

              return (
                <li key={stage.id} className={stage.order % 2 === 1 ? styles.rowStart : styles.rowEnd}>
                  <span className={styles.knot} aria-hidden />
                  <button
                    type="button"
                    className={`${isDone ? styles.cardDone : isNext ? styles.cardNext : styles.card} ${SUBJECT_CLASS[stage.subjectKey]}`}
                    onClick={() => onPlay(stage)}
                  >
                    <span className={styles.order} aria-hidden>
                      {stage.order.toLocaleString('fa-IR')}
                    </span>

                    <span className={styles.body}>
                      <span className={styles.title}>{stage.title}</span>
                      <span className={styles.meta}>
                        <span className={styles.subject}>
                          <Icon aria-hidden />
                          {stage.subject}
                        </span>
                        <span className={styles.coin}>
                          <CoinIcon size={13} aria-hidden />
                          {stage.coinReward.toLocaleString('fa-IR')}
                        </span>
                      </span>
                      {isNext && <span className={styles.nextTag}>الان نوبتِ توئه</span>}
                    </span>

                    <span className={styles.action} aria-hidden>
                      {isDone ? <HiOutlineCheck /> : <HiOutlinePlay />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          <header className={styles.weekHead}>
            <span
              className={
                week.state === 'done'
                  ? styles.weekPillDone
                  : week.state === 'current'
                    ? styles.weekPillCurrent
                    : styles.weekPill
              }
            >
              {week.label}
            </span>
            <span className={styles.weekNote}>
              {WEEK_NOTE[week.state]} · {week.completedCount.toLocaleString('fa-IR')}/
              {week.stages.length.toLocaleString('fa-IR')}
            </span>
          </header>

        </section>
      ))}
    </div>
  );
}
