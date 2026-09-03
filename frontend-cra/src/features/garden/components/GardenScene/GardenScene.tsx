import { HiOutlinePlus, HiOutlineLockClosed } from 'react-icons/hi2';
import { PlantSprite } from './PlantSprite';
import type { Season } from '../../gardenData';
import type { GrowthStage, Plant } from '../../types';
import styles from './GardenScene.module.css';

const MAX_SLOTS_SHOWN = 6;

interface Props {
  plants: (Plant & { stage: GrowthStage })[];
  slots: number;
  decor: string[];
  season: Season;
  watering: boolean;
  canPlant: boolean;
  onPlantSlot: () => void;
}

/** صحنه‌ی باغچه: آسمانِ فصلی، خورشید و ابرها، بستر خاکِ سه‌بعدی و گیاهانِ در حال رشد */
export function GardenScene({ plants, slots, decor, season, watering, canPlant, onPlantSlot }: Props) {
  const emptyUnlocked = Math.max(0, slots - plants.length);
  const locked = Math.max(0, MAX_SLOTS_SHOWN - slots);

  return (
    <div className={`${styles.scene} ${styles[season]}`} data-season={season}>
      {/* آسمان */}
      <div className={styles.sun} aria-hidden>
        <span className={styles.rays} />
      </div>
      <span className={`${styles.cloud} ${styles.cloud1}`} aria-hidden />
      <span className={`${styles.cloud} ${styles.cloud2}`} aria-hidden />

      {/* تپه‌های دور */}
      <svg className={styles.hills} viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <path d="M0 90 Q80 40 170 78 T400 66 V120 H0 Z" className={styles.hillBack} />
        <path d="M0 108 Q120 66 240 100 T400 92 V120 H0 Z" className={styles.hillFront} />
      </svg>

      {/* تزئین‌ها */}
      {decor.includes('pond') && <span className={styles.pond} aria-hidden />}
      {decor.includes('lantern') && (
        <>
          <span className={styles.warmGlow} aria-hidden />
          <span className={styles.lantern} aria-hidden>
            <span className={styles.lanternGlow} />
          </span>
        </>
      )}
      {decor.includes('butterfly') && (
        <>
          <span className={`${styles.butterfly} ${styles.bfly1}`} aria-hidden>
            <span className={styles.wing} />
            <span className={`${styles.wing} ${styles.wingR}`} />
          </span>
          <span className={`${styles.butterfly} ${styles.bfly2}`} aria-hidden>
            <span className={styles.wing} />
            <span className={`${styles.wing} ${styles.wingR}`} />
          </span>
        </>
      )}

      {/* بستر خاک سه‌بعدی */}
      <div className={styles.field} aria-hidden>
        <div className={styles.soil}>
          <span className={styles.furrow} />
          <span className={styles.furrow} />
          <span className={styles.furrow} />
        </div>
      </div>

      {/* جای کاشت‌ها */}
      <div className={styles.plots}>
        {plants.map((p) => (
          <div key={p.id} className={styles.slot}>
            <div className={styles.plant} data-stage={p.stage}>
              <PlantSprite kind={p.kind} stage={p.stage} />
            </div>
            <span className={styles.shadow} aria-hidden />
          </div>
        ))}

        {Array.from({ length: emptyUnlocked }).map((_, i) => (
          <button
            key={`empty-${i}`}
            type="button"
            className={styles.emptySlot}
            onClick={onPlantSlot}
            disabled={!canPlant}
            aria-label="اینجا دانه بکار"
          >
            <span className={styles.mound} aria-hidden />
            <HiOutlinePlus className={styles.plusIcon} aria-hidden />
          </button>
        ))}

        {Array.from({ length: locked }).map((_, i) => (
          <div key={`lock-${i}`} className={styles.lockedSlot} aria-hidden>
            <HiOutlineLockClosed className={styles.lockIcon} />
          </div>
        ))}
      </div>

      {/* انیمیشن آبیاری */}
      {watering && (
        <div className={styles.rain} aria-hidden>
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className={styles.drop} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
      )}
    </div>
  );
}
