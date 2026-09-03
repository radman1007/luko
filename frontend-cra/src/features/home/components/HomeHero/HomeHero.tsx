import { LUKORIANS } from 'lib/characters';
import styles from './HomeHero.module.css';

interface Props {
  name: string;
}

/** سرصفحه‌ی خانه — همان الگوی سرصفحه‌ی بقیه‌ی صفحه‌ها، با میزبانِ خودش: لوکی */
export function HomeHero({ name }: Props) {
  const luki = LUKORIANS.luko;

  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>شهر لوکو</p>
        <h1 className={styles.name}>سلام {name}!</h1>
        <p className={styles.role}>
          {luki.name}، {luki.role}
        </p>
        <p className={styles.tagline}>«امروز کجای شهر بریم؟»</p>
      </div>
      <img className={styles.character} src={luki.image} alt={luki.name} />
    </header>
  );
}
