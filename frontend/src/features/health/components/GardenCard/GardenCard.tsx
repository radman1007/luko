import { HiOutlineSparkles } from 'react-icons/hi2';
import { PlantIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { useGarden, MAX_STAGE } from '../../useGarden';
import styles from './GardenCard.module.css';

const STAGE_TEXT = ['یه دونه‌ی کوچیک کاشتی', 'جوونه زد!', 'داره قد می‌کشه', 'گل داد! آفرین'] as const;

export function GardenCard() {
  const gardener = LUKORIANS.garden;
  const { stage, canWater, water } = useGarden();

  return (
    <section className={styles.card} aria-label="باغچه‌ی من">
      <div className={styles.head}>
        <img className={styles.character} src={gardener.image} alt={gardener.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{gardener.name}، {gardener.role}</p>
          <p className={styles.text}>هر روز به گیاهت سر بزن و آبش بده تا با هم بزرگش کنیم!</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.texts}>
          <h2 className={styles.title}>باغچه‌ی من</h2>
          <p className={styles.subtitle}>{STAGE_TEXT[stage]}</p>
          <button type="button" className={styles.action} onClick={water} disabled={!canWater}>
            <HiOutlineSparkles aria-hidden />
            {canWater ? 'آب بده' : 'گیاهت سیرابه؛ بعداً برگرد'}
          </button>
        </div>
        <div className={styles.plantWrap}>
          <PlantIcon stage={stage} size={92} className={styles.plant} />
          <span className={styles.stageBadge}>
            {stage.toLocaleString('fa-IR')}/{MAX_STAGE.toLocaleString('fa-IR')}
          </span>
        </div>
      </div>
    </section>
  );
}
