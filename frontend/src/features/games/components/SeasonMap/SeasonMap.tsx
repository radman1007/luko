import { useEffect, useRef } from 'react';
import { HiOutlineFlag } from 'react-icons/hi2';
import type { SeasonStage, SeasonWeek } from '../../seasonData';
import { useElementWidth, useSeasonMap } from '../../useSeasonMap';
import { StageNode } from '../StageNode/StageNode';
import { CloudGate } from '../CloudGate/CloudGate';
import styles from './SeasonMap.module.css';

interface Props {
  openWeeks: SeasonWeek[];
  cloudedWeeks: SeasonWeek[];
  daysToNextWeek?: number;
  done: Set<string>;
  currentStage?: SeasonStage;
  onPlay: (stage: SeasonStage) => void;
}

/** مرحله‌ی جاری کجای پنجره بنشیند — کمی پایین‌تر از وسط، تا مسیرِ پیشِ رو دیده شود */
const FOCUS_RATIO = 0.58;

/**
 * نقشه‌ی سیزن: مسیری مارپیچ از پایین به بالا که مرحله‌ها دایره‌وار رویش
 * نشسته‌اند و بالایش زیرِ ابرهای هفته‌های نرسیده گم می‌شود.
 *
 * صفحه با بازشدن روی مرحله‌ی جاری اسکرول می‌شود؛ تا وقتی بچه چیزی نرفته
 * یعنی تهِ نقشه، و با هر مرحله‌ای که تمام می‌کند یک پله بالاتر.
 */
export function SeasonMap({
  openWeeks,
  cloudedWeeks,
  daysToNextWeek,
  done,
  currentStage,
  onPlay,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const map = useSeasonMap(openWeeks, done, currentStage?.id, width, cloudedWeeks.length > 0);
  const focused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    // تا وقتی چیدمان اندازه نگرفته، جای مرحله معلوم نیست
    if (focused.current || !el || width === 0 || map.currentY === undefined) return;
    focused.current = true;

    const top = el.getBoundingClientRect().top + window.scrollY + map.currentY;
    window.scrollTo({
      top: Math.max(0, top - window.innerHeight * FOCUS_RATIO),
      behavior: 'instant',
    });
  }, [ref, width, map.currentY]);

  return (
    <div className={styles.map} ref={ref} style={{ height: map.height }}>
      {/* مسیر زیرِ گره‌ها می‌ماند؛ کلیک هم نمی‌گیرد */}
      <svg className={styles.path} width={width} height={map.height} aria-hidden focusable="false">
        <defs>
          <linearGradient id="luko-lit" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#9b7ce0" />
            <stop offset="100%" stopColor="#4fd8c8" />
          </linearGradient>
        </defs>
        {map.trackPath && (
          <>
            <path className={styles.trackBase} d={map.trackPath} />
            <path className={styles.trackDash} d={map.trackPath} />
            <path className={styles.trackLit} d={map.litPath} />
          </>
        )}
      </svg>

      {/* ایست‌گاهِ هر هفته، درست جایی که هفته عوض می‌شود */}
      {map.weekMarks.map(({ week, y, side }) => (
        <div
          key={week.index}
          className={`${styles.milestone} ${side === 'left' ? styles.mileLeft : styles.mileRight}`}
          style={{ top: y }}
        >
          <span className={week.state === 'done' ? styles.milePillDone : styles.milePill}>
            {week.label}
            <b className={styles.mileCount}>
              {week.completedCount.toLocaleString('fa-IR')}/{week.stages.length.toLocaleString('fa-IR')}
            </b>
          </span>
        </div>
      ))}

      {/* سایه‌ی مرحله‌های نرسیده — پشتِ ابرها، بی‌شماره و بی‌نام تا لو نروند */}
      {map.ghosts.map((ghost, i) => (
        <span
          key={`ghost-${i}`}
          className={styles.ghost}
          style={{ top: ghost.y, left: ghost.x }}
          aria-hidden
        />
      ))}

      {map.nodes.map((node) => (
        <StageNode key={node.stage.id} node={node} onPlay={() => onPlay(node.stage)} />
      ))}

      {/* پرچمِ شروع، کفِ مسیر */}
      <div className={styles.start}>
        <span className={styles.startPill}>
          <HiOutlineFlag aria-hidden />
          شروعِ سیزن
        </span>
      </div>

      {/* ابرها سقفِ نقشه‌اند: مسیر واقعاً زیرشان می‌رود و ادامه‌اش پیدا نیست */}
      <CloudGate weeks={cloudedWeeks} daysToNextWeek={daysToNextWeek} />
    </div>
  );
}
