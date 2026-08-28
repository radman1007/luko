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

/**
 * یک مرحله روی نقشه: دایره‌ای که مرکزش دقیقاً روی مسیر می‌نشیند.
 * سه حالت دارد — رفته، نوبتِ توئه، و بازِ نرفته.
 */
export function StageNode({ node, onPlay }: Props) {
  const { stage, done, isCurrent, locked } = node;
  const Icon = SUBJECT_ICON[stage.subjectKey];
  const state = locked ? styles.locked : done ? styles.done : isCurrent ? styles.current : styles.open;

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
        aria-label={`مرحله‌ی ${stage.order.toLocaleString('fa-IR')}، ${stage.title}، ${stage.subject}${done ? '، تمام‌شده' : locked ? '، هنوز باز نشده' : ''}`}
      >
        <span className={styles.face} aria-hidden>
          {locked ? (
            <span className={styles.lock}>
              <HiOutlineLockClosed />
            </span>
          ) : done ? (
            <span className={styles.check}>
              <DoneMark />
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
        <span className={styles.coin}>
          <CoinIcon size={12} aria-hidden />
          {stage.coinReward.toLocaleString('fa-IR')}
        </span>
      </span>
    </div>
  );
}
