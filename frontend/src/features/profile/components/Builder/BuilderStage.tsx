import { useState } from 'react';
import {
  HiOutlineArrowUturnLeft,
  HiOutlineArrowUturnRight,
  HiOutlineFaceSmile,
  HiOutlinePaintBrush,
  HiOutlinePencil,
  HiOutlineScissors,
  HiOutlineSparkles,
  HiOutlineSwatch,
} from 'react-icons/hi2';
import { TreasureIcon } from '@/components/ui/icons';
import { BUILDER_PRICES } from '../../config';
import styles from './BuilderStage.module.css';

const OPTIONS = [
  { id: 'skin', label: 'رنگ پوست', icon: HiOutlinePaintBrush, price: BUILDER_PRICES.skinColor },
  { id: 'outfit', label: 'لباس', icon: HiOutlineSwatch, price: BUILDER_PRICES.outfit },
  { id: 'hair', label: 'مو', icon: HiOutlineScissors, price: BUILDER_PRICES.hair },
  { id: 'face', label: 'چهره', icon: HiOutlineFaceSmile, price: BUILDER_PRICES.face },
  { id: 'name', label: 'اسم', icon: HiOutlinePencil, price: BUILDER_PRICES.name },
  { id: 'accessory', label: 'اکسسوری', icon: HiOutlineSparkles, price: BUILDER_PRICES.accessory },
] as const;

interface Props {
  /** تا باز نشدن کارگاه، گزینه‌ها قفل‌اند */
  locked: boolean;
}

/**
 * صحنه‌ی سه‌بعدیِ کارگاه — فعلاً خالی؛
 * TODO: بعد از رسیدن تصویر پایه‌ی لوکوریان، کاراکتر قابل‌چرخش اینجا می‌نشیند
 */
export function BuilderStage({ locked }: Props) {
  const [angle, setAngle] = useState(0);

  const right = OPTIONS.slice(0, 3);
  const left = OPTIONS.slice(3);

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <div className={styles.options}>
          {right.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={styles.option}
              disabled={locked}
              title={locked ? 'اول کارگاه رو باز کن!' : 'به‌زودی'}
            >
              <opt.icon className={styles.optionIcon} aria-hidden />
              <span className={styles.optionLabel}>{opt.label}</span>
              <span className={styles.price}>
                <TreasureIcon size={12} aria-hidden />
                {opt.price.toLocaleString('fa-IR')}
              </span>
            </button>
          ))}
        </div>

        <div className={styles.stagePerspective}>
          <div className={styles.stage} style={{ transform: `rotateY(${angle}deg)` }}>
            <div className={styles.silhouette}>
              <span className={styles.silhouetteText}>جای لوکوریانِ توئه!</span>
            </div>
          </div>
          <span className={styles.floor} aria-hidden />
        </div>

        <div className={styles.options}>
          {left.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={styles.option}
              disabled={locked}
              title={locked ? 'اول کارگاه رو باز کن!' : 'به‌زودی'}
            >
              <opt.icon className={styles.optionIcon} aria-hidden />
              <span className={styles.optionLabel}>{opt.label}</span>
              <span className={styles.price}>
                <TreasureIcon size={12} aria-hidden />
                {opt.price.toLocaleString('fa-IR')}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.rotateRow}>
        <button
          type="button"
          className={styles.rotateBtn}
          onClick={() => setAngle((a) => a - 60)}
          aria-label="چرخش به چپ"
        >
          <HiOutlineArrowUturnLeft />
        </button>
        <span className={styles.rotateHint}>بچرخونش!</span>
        <button
          type="button"
          className={styles.rotateBtn}
          onClick={() => setAngle((a) => a + 60)}
          aria-label="چرخش به راست"
        >
          <HiOutlineArrowUturnRight />
        </button>
      </div>
    </div>
  );
}
