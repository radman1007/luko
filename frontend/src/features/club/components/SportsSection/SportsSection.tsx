import { useState } from 'react';
import { HiOutlineCheck, HiOutlinePlay } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { SPORT_TASKS } from '../../clubData';
import type { SportTask } from '../../types';
import { SportSession } from '../SportSession/SportSession';
import styles from './SportsSection.module.css';

interface Props {
  doneIds: string[];
}

/**
 * تمرین‌های چابک. هیچ‌کدام تیکِ دستی ندارند: زدنِ «شروع» تمرینِ
 * هدایت‌شده را باز می‌کند و امتیاز فقط با تمام‌کردنِ آن می‌آید.
 */
export function SportsSection({ doneIds }: Props) {
  const champ = LUKORIANS.sport;
  const [active, setActive] = useState<SportTask | null>(null);

  return (
    <section className={styles.card} aria-label="حرکت با چابک">
      <div className={styles.head}>
        <img className={styles.character} src={champ.image} alt={champ.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{champ.name}، {champ.role}</p>
          <p className={styles.text}>بیا بجنبیم! تمرین رو باهام تا آخر برو تا سکه بگیری!</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <ul className={styles.list}>
        {SPORT_TASKS.map((task) => {
          const done = doneIds.includes(task.id);
          return (
            <li key={task.id} className={`${styles.item} ${done ? styles.done : ''}`}>
              <span className={styles.iconWrap} aria-hidden>
                {done ? <HiOutlineCheck /> : <task.icon />}
              </span>
              <span className={styles.taskTitle}>{task.title}</span>
              <span className={styles.reward}>
                <CoinIcon size={15} aria-hidden />
                {task.coinReward.toLocaleString('fa-IR')}
              </span>
              {done ? (
                <span className={styles.doneTag}>انجام شد</span>
              ) : (
                <button
                  type="button"
                  className={styles.startBtn}
                  onClick={() => setActive(task)}
                  aria-label={`شروعِ ${task.title}`}
                >
                  <HiOutlinePlay aria-hidden />
                  شروع
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {active && <SportSession task={active} onClose={() => setActive(null)} />}
    </section>
  );
}
