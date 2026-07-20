import { HiOutlineCheckCircle } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { DAILY_MISSIONS } from '../../clubData';
import styles from './DailyMissions.module.css';

interface Props {
  doneIds: string[];
  onComplete: (missionId: string) => void;
}

export function DailyMissions({ doneIds, onComplete }: Props) {
  return (
    <section className={styles.card} aria-label="مأموریت‌های امروز">
      <h2 className={styles.title}>مأموریت‌های امروز</h2>
      <p className={styles.subtitle}>هر مأموریت رو انجام بدی، توپا بهت سکه می‌ده</p>

      <ul className={styles.list}>
        {DAILY_MISSIONS.map((mission) => {
          const done = doneIds.includes(mission.id);
          return (
            <li key={mission.id} className={`${styles.item} ${done ? styles.done : ''}`}>
              <span className={styles.iconWrap} aria-hidden>
                <mission.icon />
              </span>
              <span className={styles.missionTitle}>{mission.title}</span>
              <span className={styles.reward}>
                <CoinIcon size={15} aria-hidden />
                {mission.coinReward.toLocaleString('fa-IR')}
              </span>
              <button
                type="button"
                className={styles.checkBtn}
                onClick={() => onComplete(mission.id)}
                disabled={done}
                aria-label={done ? `${mission.title} انجام شد` : `انجام ${mission.title}`}
              >
                <HiOutlineCheckCircle />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
