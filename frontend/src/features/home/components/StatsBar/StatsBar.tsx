import { HiOutlineFire, HiOutlineStar } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import styles from './StatsBar.module.css';

interface Props {
  coins: number;
  streak: number;
  xp: number;
}

export function StatsBar(props: Props) {
  const stats = [
    { key: 'coins' as const, label: 'سکه', icon: <CoinIcon size={22} /> },
    { key: 'streak' as const, label: 'روز پیاپی', icon: <HiOutlineFire size={22} /> },
    { key: 'xp' as const, label: 'امتیاز', icon: <HiOutlineStar size={22} /> },
  ];

  return (
    <div className={styles.bar}>
      {stats.map(({ key, label, icon }) => (
        <div key={key} className={styles.stat}>
          <span className={styles.icon} aria-hidden>
            {icon}
          </span>
          <span className={styles.value}>{props[key].toLocaleString('fa-IR')}</span>
          <span className={styles.label}>{label}</span>
        </div>
      ))}
    </div>
  );
}
