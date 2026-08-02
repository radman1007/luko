import { HiOutlineWrenchScrewdriver } from 'react-icons/hi2';
import styles from './ComingSoonPanel.module.css';

interface Props {
  title: string;
  description: string;
}

/** بخش‌هایی از پنل که هنوز ساخته نشده‌اند */
export function ComingSoonPanel({ title, description }: Props) {
  return (
    <section className={styles.box}>
      <span className={styles.icon} aria-hidden>
        <HiOutlineWrenchScrewdriver size={22} />
      </span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.description}>{description}</p>
    </section>
  );
}
