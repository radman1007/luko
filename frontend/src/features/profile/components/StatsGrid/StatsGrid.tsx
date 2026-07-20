import { HiOutlineFire, HiOutlinePuzzlePiece, HiOutlineStar, HiOutlineTrophy } from 'react-icons/hi2';
import { CoinIcon, TreasureIcon } from '@/components/ui/icons';
import styles from './StatsGrid.module.css';

interface Props {
  coins: number;
  xp: number;
  streak: number;
  gamesCompleted: number;
  medalsUnlocked: number;
  treasures: number;
}

export function StatsGrid(props: Props) {
  const stats = [
    { label: 'سکه', value: props.coins, icon: <CoinIcon size={22} /> },
    { label: 'امتیاز', value: props.xp, icon: <HiOutlineStar size={22} /> },
    { label: 'روز پیاپی', value: props.streak, icon: <HiOutlineFire size={22} /> },
    { label: 'بازی تموم‌شده', value: props.gamesCompleted, icon: <HiOutlinePuzzlePiece size={22} /> },
    { label: 'مدال', value: props.medalsUnlocked, icon: <HiOutlineTrophy size={22} /> },
  ];

  return (
    <div className={styles.grid}>
      {stats.map(({ label, value, icon }) => (
        <div key={label} className={styles.stat}>
          <span className={styles.icon} aria-hidden>
            {icon}
          </span>
          <span className={styles.value}>{value.toLocaleString('fa-IR')}</span>
          <span className={styles.label}>{label}</span>
        </div>
      ))}
      <div className={`${styles.stat} ${styles.treasure}`}>
        <span className={styles.icon} aria-hidden>
          <TreasureIcon size={22} />
        </span>
        <span className={styles.value}>{props.treasures.toLocaleString('fa-IR')}</span>
        <span className={styles.label}>گنج گمشده</span>
      </div>
    </div>
  );
}
