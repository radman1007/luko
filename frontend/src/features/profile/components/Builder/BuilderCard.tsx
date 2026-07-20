import { HiOutlineCamera } from 'react-icons/hi2';
import { TreasureIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { CUSTOM_CHARACTER, TREASURE } from '../../config';
import { isBuilderUnlocked } from '../../unlock';
import type { BuilderStats } from '../../unlock';
import { BuilderStage } from './BuilderStage';
import { UnlockProgress } from './UnlockProgress';
import styles from './BuilderCard.module.css';

interface Props {
  stats: BuilderStats;
  treasures: number;
}

export function BuilderCard({ stats, treasures }: Props) {
  const explorer = LUKORIANS.explorer;
  const unlocked = isBuilderUnlocked(stats);

  return (
    <section className={styles.card} aria-label="کارگاه لوکوریان‌سازی">
      <div className={styles.head}>
        <img className={styles.character} src={explorer.image} alt={explorer.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{explorer.name}، {explorer.role}</p>
          <p className={styles.text}>
            قطب‌نمام می‌گه {TREASURE.name}‌های گمشده‌ی شهر پیش بچه‌های کوشاست! پیداشون کنی، مکانو
            توی کارگاهش یه لوکوریانِ مخصوص خودت می‌سازه.
          </p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div className={styles.treasureRow}>
        <span className={styles.treasureBadge}>
          <TreasureIcon size={18} aria-hidden />
          {treasures.toLocaleString('fa-IR')} {TREASURE.name}
        </span>
        <span className={styles.treasureHint}>
          {TREASURE.name} با سکه خریدنی نیست؛ فقط با دستاوردهای بزرگ پیدا می‌شه!
        </span>
      </div>

      {!unlocked && <UnlockProgress stats={stats} />}

      <BuilderStage locked={!unlocked} />

      <div className={styles.photoBox}>
        <span className={styles.photoIcon} aria-hidden>
          <HiOutlineCamera />
        </span>
        <div className={styles.photoTexts}>
          <p className={styles.photoTitle}>لوکوریانِ شبیه خودت!</p>
          <p className={styles.photoDesc}>
            عکستو برامون بفرست؛ تا {CUSTOM_CHARACTER.deliveryDays.toLocaleString('fa-IR')} روز
            بعد، کاراکترت با همون قیافه و استایل آماده می‌شه.
          </p>
        </div>
        <button type="button" className={styles.photoBtn} disabled title="به‌زودی">
          <TreasureIcon size={15} aria-hidden />
          {CUSTOM_CHARACTER.priceTreasure.toLocaleString('fa-IR')} {TREASURE.name}
        </button>
      </div>
    </section>
  );
}
