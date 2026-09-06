import { useEffect, useRef, useState } from 'react';
import type { IconType } from 'react-icons';
import {
  HiOutlineBeaker,
  HiOutlineBookOpen,
  HiOutlineCalculator,
  HiOutlineLockClosed,
  HiOutlinePencil,
  HiOutlinePlay,
  HiOutlinePuzzlePiece,
} from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { StarRating } from '../StarRating/StarRating';
import type { SubjectKey } from '../../seasonData';
import type { MapNode } from '../../useSeasonMap';
import styles from './StageNode.module.css';

interface Props {
  node: MapNode;
  onPlay: () => void;
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

/** تیکِ ضخیم و گِرد — از تیکِ نازکِ کتابخانه روی دایره بهتر می‌نشیند */
function DoneMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M5 12.5 10 17.5 19 7"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** تاجِ تسلط — نشانِ مرحله‌ای که سه‌ستاره شده */
function CrownMark() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M3.5 17.5h17l1.2-9-5.4 3.4L12 4.5 7.7 11.9 2.3 8.5l1.2 9Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * یک مرحله روی نقشه: دایره‌ای که مرکزش دقیقاً روی مسیر می‌نشیند.
 * سه حالت دارد — رفته، نوبتِ توئه، و بازِ نرفته.
 */
export function StageNode({ node, onPlay }: Props) {
  const { stage, done, isCurrent, locked } = node;
  const Icon = SUBJECT_ICON[stage.subjectKey];
  /**
   * سه‌ستاره حالتِ ویژه‌ی خودش را دارد: بچه باید از دور ببیند کدام مرحله
   * را «فتح» کرده و کدام هنوز جا برای بهتر شدن دارد — همین است که او را
   * برای بازیِ دوباره برمی‌گرداند.
   */
  const mastered = done && stage.stars > 0 && stage.stars >= stage.maxStars;
  const state = locked
    ? styles.locked
    : mastered
      ? styles.mastered
      : done
        ? styles.done
        : isCurrent
          ? styles.current
          : styles.open;

  // زدنِ مرحله‌ی قفل باید جواب بدهد؛ دکمه‌ی بی‌صدا بچه را سردرگم می‌کند
  const [nudged, setNudged] = useState(false);
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleClick = () => {
    if (!locked) {
      onPlay();
      return;
    }
    setNudged(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNudged(false), 1800);
  };

  return (
    <div
      className={`${styles.slot} ${SUBJECT_CLASS[stage.subjectKey]}`}
      style={{ '--node-x': `${node.x}px`, '--node-y': `${node.y}px` } as React.CSSProperties}
    >
      {isCurrent && <span className={styles.flag}>الان نوبتِ توئه</span>}
      {nudged && <span className={styles.hint}>اول مرحله‌ی قبلی رو تموم کن</span>}

      <button
        type="button"
        className={`${styles.node} ${state} ${nudged ? styles.shake : ''}`}
        onClick={handleClick}
        aria-disabled={locked}
        aria-label={
          `مرحله‌ی ${stage.order.toLocaleString('fa-IR')}، ${stage.title}، ${stage.subject}` +
          (locked
            ? '، هنوز باز نشده'
            : done
              ? stage.stars > 0
                ? `، تمام‌شده با ${stage.stars.toLocaleString('fa-IR')} از ${stage.maxStars.toLocaleString('fa-IR')} ستاره`
                : '، تمام‌شده'
              : '')
        }
      >
        <span className={styles.face} aria-hidden>
          {locked ? (
            <span className={styles.lock}>
              <HiOutlineLockClosed />
            </span>
          ) : done ? (
            <span className={styles.check}>
              {mastered ? <CrownMark /> : <DoneMark />}
            </span>
          ) : (
            <>
              <Icon className={styles.icon} />
              <span className={styles.order}>{stage.order.toLocaleString('fa-IR')}</span>
            </>
          )}
        </span>

        {isCurrent && (
          <span className={styles.play} aria-hidden>
            <HiOutlinePlay />
          </span>
        )}
      </button>

      <span className={styles.caption}>
        <span className={styles.title}>{stage.title}</span>
        {done && stage.stars > 0 ? (
          <span className={styles.stars}>
            <StarRating earned={stage.stars} max={stage.maxStars} />
            {stage.stars < stage.maxStars && (
              <span className={styles.again}>دوباره بزن!</span>
            )}
          </span>
        ) : done ? (
          /* مرحله‌ای که رفته شده ولی هنوز ستاره‌ای برایش ثبت نشده — تا وقتی
             خودِ بازی ستاره ندهد، «۰ از ۳» دروغ است نه دستاوردِ کم. */
          <span className={styles.doneTag}>تمام شد</span>
        ) : (
          <span className={styles.coin}>
            <CoinIcon size={12} aria-hidden />
            {stage.coinReward.toLocaleString('fa-IR')}
          </span>
        )}
      </span>
    </div>
  );
}
