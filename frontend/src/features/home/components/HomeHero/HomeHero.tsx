import { Link } from 'react-router-dom';
import styles from './HomeHero.module.css';

interface Props {
  name: string;
}

export function HomeHero({ name }: Props) {
  return (
    <header className={styles.hero}>
      <div className={styles.texts}>
        <p className={styles.kicker}>شهر لوکو</p>
        <h1 className={styles.greeting}>سلام، {name}!</h1>
        <p className={styles.subtitle}>امروز کجای شهر بریم؟</p>
        <Link to="/profile" className={styles.profileLink}>
          پروفایل من
        </Link>
      </div>
      {/* TODO: کاراکتر اصلی صفحه بعد از رسیدن تصویرش اینجا می‌نشیند */}
      <div className={styles.characterSlot} aria-hidden>
        <span className={styles.slotText}>به‌زودی!</span>
      </div>
    </header>
  );
}
