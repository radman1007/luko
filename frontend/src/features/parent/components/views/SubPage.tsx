import type { ReactNode } from 'react';
import { HiOutlineArrowRight } from 'react-icons/hi2';
import styles from './SubPage.module.css';

interface Props {
  title: string;
  note?: string;
  onBack: () => void;
  children: ReactNode;
}

/** زیرصفحه‌ای که از خانه باز می‌شود (گزارشِ کامل، بازیِ امروز) با دکمه‌ی برگشت */
export function SubPage({ title, note, onBack, children }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <HiOutlineArrowRight aria-hidden />
          خانه
        </button>
        <div>
          <h2>{title}</h2>
          {note && <p>{note}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
