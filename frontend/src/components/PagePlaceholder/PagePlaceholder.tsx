import { HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import styles from './PagePlaceholder.module.css';

interface Props {
  title: string;
  description?: string;
}

/** صفحه‌ی موقت — با پیاده‌سازی هر صفحه حذف می‌شود */
export function PagePlaceholder({ title, description }: Props) {
  return (
    <main className={styles.wrapper}>
      <span className={styles.icon} aria-hidden>
        <HiOutlineWrenchScrewdriver />
      </span>
      <h1 className={styles.title}>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      <p className={styles.badge}>به‌زودی ساخته می‌شود</p>
    </main>
  );
}
