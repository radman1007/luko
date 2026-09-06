import { HiOutlineCamera, HiOutlineLockClosed } from 'react-icons/hi2';
import type { MemoryPoint } from '../../useSeasonMap';
import styles from './MemorySpot.module.css';

interface Props {
  point: MemoryPoint;
  /** بندانگشتیِ عکسِ ثبت‌شده، اگر بچه قبلاً اینجا عکس گرفته */
  thumbnail?: string;
  onOpen: () => void;
}

/**
 * ایستگاهِ عکسِ یادگاری روی مسیر.
 *
 * عمداً شکلش با گره‌ی بازی فرق دارد — لوزیِ قاب‌مانند به‌جای دایره — تا
 * بچه در نگاهِ اول بفهمد این «بازیِ دیگری» نیست. بعد از ثبتِ عکس، خودِ
 * عکس داخلِ قاب می‌نشیند و ایستگاه تبدیل به یادگاری می‌شود.
 */
export function MemorySpot({ point, thumbnail, onOpen }: Props) {
  const { spot, locked } = point;
  const filled = Boolean(thumbnail);

  return (
    <div
      className={`${styles.slot} ${point.side === 'left' ? styles.left : styles.right}`}
      style={{ '--node-x': `${point.x}px`, '--node-y': `${point.y}px` } as React.CSSProperties}
    >
      <button
        type="button"
        className={`${styles.spot} ${locked ? styles.locked : filled ? styles.filled : styles.ready}`}
        onClick={onOpen}
        aria-disabled={locked}
        aria-label={
          locked
            ? `ایستگاهِ یادگاری «${spot.title}»، هنوز باز نشده`
            : filled
              ? `یادگاریِ «${spot.title}»، عکس ثبت شده — برای دیدن بزن`
              : `ایستگاهِ یادگاری «${spot.title}» — برای گرفتنِ عکس بزن`
        }
      >
        <span className={styles.frame} aria-hidden>
          {filled ? (
            <img className={styles.photo} src={thumbnail} alt="" />
          ) : locked ? (
            <HiOutlineLockClosed />
          ) : (
            <HiOutlineCamera />
          )}
        </span>
        {!locked && !filled && <span className={styles.pulse} aria-hidden />}
      </button>

      <span className={styles.caption}>
        <span className={styles.title}>{spot.title}</span>
        <span className={styles.tag}>{filled ? 'یادگاری' : 'عکس بگیر'}</span>
      </span>
    </div>
  );
}
