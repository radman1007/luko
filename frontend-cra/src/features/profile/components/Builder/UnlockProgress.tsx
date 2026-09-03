import { HiOutlineLockClosed } from 'react-icons/hi2';
import { BUILDER_UNLOCK } from '../../config';
import type { BuilderStats } from '../../unlock';
import styles from './UnlockProgress.module.css';

interface Props {
  stats: BuilderStats;
}

export function UnlockProgress({ stats }: Props) {
  const rows = [
    { label: 'سکه', current: stats.coins, needed: BUILDER_UNLOCK.coins },
    { label: 'مأموریت انجام‌شده', current: stats.totalTasks, needed: BUILDER_UNLOCK.totalTasks },
    { label: 'روز پیاپی فعالیت', current: stats.streak, needed: BUILDER_UNLOCK.streak },
    { label: 'بازی تمام‌شده', current: stats.gamesCompleted, needed: BUILDER_UNLOCK.gamesCompleted },
  ];

  return (
    <div className={styles.box}>
      <p className={styles.title}>
        <HiOutlineLockClosed aria-hidden />
        برای باز شدن کارگاه، این‌ها رو کامل کن:
      </p>
      <ul className={styles.list}>
        {rows.map(({ label, current, needed }) => {
          const percent = Math.min(100, Math.round((current / needed) * 100));
          return (
            <li key={label} className={styles.row}>
              <span className={styles.label}>{label}</span>
              <span className={styles.bar}>
                <span className={styles.fill} style={{ width: `${percent}%` }} />
              </span>
              <span className={styles.numbers}>
                {Math.min(current, needed).toLocaleString('fa-IR')}/
                {needed.toLocaleString('fa-IR')}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
