import type { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'teal' | 'orange' | 'violet' | 'green' | 'blue' | 'red';
  live?: boolean;
}

/** کاشیِ عدد — یک عدد، یک برچسب، یک توضیحِ کوتاه */
export function StatCard({ label, value, hint, icon, tone = 'teal', live }: Props) {
  return (
    <div className={styles.card} data-tone={tone}>
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon} aria-hidden>{icon}</span>}
      </div>
      <div className={styles.value}>
        {live && <span className={styles.live} aria-label="زنده" />}
        {value}
      </div>
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
