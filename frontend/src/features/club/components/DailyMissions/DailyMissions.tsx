import { Link } from 'react-router-dom';
import { HiOutlineArrowLeft, HiOutlineCheck } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { DAILY_MISSIONS } from '../../clubData';
import styles from './DailyMissions.module.css';
import { SEASON_MAP_PATH } from '@/lib/constants/nav';

interface Props {
  doneIds: string[];
}

/** هر مأموریت کجای اپ انجام می‌شود — تیک دستی نداریم، پس راه را نشان می‌دهیم */
const MISSION_LINK: Record<string, { to: string; label: string }> = {
  game: { to: SEASON_MAP_PATH, label: 'برو به تالار بازی‌ها' },
  mood: { to: '/luko-health', label: 'برو پیشِ دکتر نیلا' },
  breath: { to: '/luko-health', label: 'برو سراغِ نفس جادویی' },
  garden: { to: '/garden', label: 'برو به باغچه' },
};

/**
 * مأموریت‌های امروز — فقط نمایش.
 * تیکِ دستی عمداً برداشته شده: هر مأموریت وقتی ثبت می‌شود که خودِ کار
 * انجام شود (پایانِ بازی، ثبتِ حال، یک دور تنفس، آب‌دادنِ باغچه).
 */
export function DailyMissions({ doneIds }: Props) {
  return (
    <section className={styles.card} aria-label="مأموریت‌های امروز">
      <h2 className={styles.title}>مأموریت‌های امروز</h2>
      <p className={styles.subtitle}>هر کدوم رو انجام بدی، توپا خودش سکه‌تو می‌ده</p>

      <ul className={styles.list}>
        {DAILY_MISSIONS.map((mission) => {
          const done = doneIds.includes(mission.id);
          const link = MISSION_LINK[mission.id];

          return (
            <li key={mission.id} className={`${styles.item} ${done ? styles.done : ''}`}>
              <span className={styles.iconWrap} aria-hidden>
                {done ? <HiOutlineCheck /> : <mission.icon />}
              </span>

              <span className={styles.texts}>
                <span className={styles.missionTitle}>{mission.title}</span>
                {done ? (
                  <span className={styles.doneTag}>انجام شد</span>
                ) : (
                  link && (
                    <Link className={styles.go} to={link.to}>
                      {link.label}
                      <HiOutlineArrowLeft aria-hidden />
                    </Link>
                  )
                )}
              </span>

              <span className={styles.reward}>
                <CoinIcon size={15} aria-hidden />
                {mission.coinReward.toLocaleString('fa-IR')}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
