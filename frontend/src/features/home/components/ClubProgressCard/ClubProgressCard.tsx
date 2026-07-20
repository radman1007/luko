import { useNavigate } from 'react-router-dom';
import { HiOutlineFire, HiOutlineTrophy } from 'react-icons/hi2';
import { LUKORIANS } from '@/lib/characters';
import { DAILY_MISSIONS, SPORT_TASKS } from '@/features/club/clubData';
import styles from './ClubProgressCard.module.css';

interface Props {
  doneToday: number;
  streak: number;
}

export function ClubProgressCard({ doneToday, streak }: Props) {
  const navigate = useNavigate();
  const coach = LUKORIANS.club;
  const totalToday = DAILY_MISSIONS.length + SPORT_TASKS.length;
  const remaining = Math.max(0, totalToday - doneToday);
  const percent = Math.round((doneToday / totalToday) * 100);

  const coachSays =
    remaining === 0
      ? 'همه رو زدی؟! ایول، امروز حریف نداری!'
      : doneToday === 0
        ? `هنوز هیچی نزدی! ${totalToday.toLocaleString('fa-IR')} تا مأموریت خاک می‌خوره...`
        : `${doneToday.toLocaleString('fa-IR')} تا زدی، ${remaining.toLocaleString('fa-IR')} تا مونده. نصفه ولش نکنی!`;

  return (
    <section className={styles.card} aria-label="لوکو کلاب">
      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          <HiOutlineTrophy aria-hidden />
          لوکو کلاب
        </h2>
        <span className={styles.streak}>
          <HiOutlineFire aria-hidden />
          {streak.toLocaleString('fa-IR')} روز پیاپی
        </span>
      </div>
      <p className={styles.desc}>باشگاه مأموریت و جایزه؛ مربی {coach.name} می‌گه:</p>
      <p className={styles.coachSays}>«{coachSays}»</p>

      <div className={styles.progressRow}>
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className={styles.fill} style={{ width: `${percent}%` }} />
        </div>
        <span className={styles.numbers}>
          {doneToday.toLocaleString('fa-IR')}/{totalToday.toLocaleString('fa-IR')}
        </span>
      </div>

      <button type="button" className={styles.cta} onClick={() => navigate('/luko-club')}>
        بریم باشگاه
      </button>
    </section>
  );
}
