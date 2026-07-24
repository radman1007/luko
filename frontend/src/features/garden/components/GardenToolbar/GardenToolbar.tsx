import { WateringCanIcon, FertilizerIcon, SeedIcon } from '@/components/ui/icons';
import styles from './GardenToolbar.module.css';

interface Props {
  currentWater: number;
  maxWater: number;
  nextRefillMs: number;
  fertilizer: number;
  seeds: number;
  canWater: boolean;
  canFertilize: boolean;
  canPlant: boolean;
  onWater: () => void;
  onFertilize: () => void;
  onPlant: () => void;
}

/** ابزارهای مراقبت از باغچه: آبیاری، کوددهی و کاشت دانه به‌همراه موجودی هرکدام */
export function GardenToolbar({
  currentWater,
  maxWater,
  nextRefillMs,
  fertilizer,
  seeds,
  canWater,
  canFertilize,
  canPlant,
  onWater,
  onFertilize,
  onPlant,
}: Props) {
  const refillMin = Math.ceil(nextRefillMs / 60_000);

  return (
    <div className={styles.toolbar}>
      <button type="button" className={styles.tool} onClick={onWater} disabled={!canWater}>
        <span className={styles.iconWrap}>
          <WateringCanIcon size={26} aria-hidden />
        </span>
        <span className={styles.label}>آب بده</span>
        <span className={styles.count}>
          {currentWater.toLocaleString('fa-IR')}/{maxWater.toLocaleString('fa-IR')}
        </span>
        {currentWater < maxWater && refillMin > 0 && (
          <span className={styles.hint}>{refillMin.toLocaleString('fa-IR')} دقیقه تا آب بعدی</span>
        )}
      </button>

      <button type="button" className={styles.tool} onClick={onFertilize} disabled={!canFertilize}>
        <span className={styles.iconWrap}>
          <FertilizerIcon size={26} aria-hidden />
        </span>
        <span className={styles.label}>کود بده</span>
        <span className={styles.count}>{fertilizer.toLocaleString('fa-IR')} کیسه</span>
      </button>

      <button type="button" className={styles.tool} onClick={onPlant} disabled={!canPlant}>
        <span className={styles.iconWrap}>
          <SeedIcon size={26} aria-hidden />
        </span>
        <span className={styles.label}>دانه بکار</span>
        <span className={styles.count}>{seeds.toLocaleString('fa-IR')} دانه</span>
      </button>
    </div>
  );
}
