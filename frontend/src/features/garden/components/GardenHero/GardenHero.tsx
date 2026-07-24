import { DewIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import type { SeasonInfo } from '../../gardenData';
import styles from './GardenHero.module.css';

interface Props {
  dew: number;
  season: SeasonInfo;
}

/** سرصفحه‌ی باغچه — هدرِ هم‌شکلِ بقیه‌ی صفحه‌ها + کارتِ سفیدِ روی‌هم‌افتاده که فصل را نشان می‌دهد */
export function GardenHero({ dew, season }: Props) {
  const gardener = LUKORIANS.garden;
  const pct = Math.round(season.progress * 100);

  return (
    <>
      <header className={styles.hero}>
        <div className={styles.texts}>
          <p className={styles.kicker}>لوکو باغچه</p>
          <h1 className={styles.name}>{gardener.name}</h1>
          <p className={styles.role}>{gardener.role}</p>
          <p className={styles.dew}>
            <DewIcon size={18} aria-hidden />
            {dew.toLocaleString('fa-IR')} شبنم
          </p>
        </div>
        <img className={styles.character} src={gardener.image} alt={gardener.name} />
      </header>

      <section className={styles.seasonCard} aria-label="فصل باغچه">
        <div className={styles.seasonHead}>
          <h2 className={styles.seasonTitle}>سال تحصیلی باغچه</h2>
          <span className={styles.seasonBadge}>فصل: {season.label}</span>
        </div>
        <div className={styles.progressRow}>
          <div
            className={styles.track}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="پیشرفت سال تحصیلی"
          >
            <span className={styles.fill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.pct}>{pct.toLocaleString('fa-IR')}٪</span>
        </div>
      </section>
    </>
  );
}
