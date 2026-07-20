import { HiOutlineCheckCircle } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { SPORT_TASKS } from '../../clubData';
import styles from './SportsSection.module.css';

interface Props {
  doneIds: string[];
  onComplete: (taskId: string) => void;
}

export function SportsSection({ doneIds, onComplete }: Props) {
  const champ = LUKORIANS.sport;

  return (
    <section className={styles.card} aria-label="حرکت با چابک">
      <div className={styles.head}>
        <img className={styles.character} src={champ.image} alt={champ.name} />
        <div className={styles.bubble}>
          <p className={styles.speaker}>{champ.name}، {champ.role}</p>
          <p className={styles.text}>بیا بجنبیم! هر حرکتی بزنی ازم سکه می‌گیری!</p>
          <span className={styles.tail} aria-hidden />
        </div>
      </div>

      <ul className={styles.list}>
        {SPORT_TASKS.map((task) => {
          const done = doneIds.includes(task.id);
          return (
            <li key={task.id} className={`${styles.item} ${done ? styles.done : ''}`}>
              <span className={styles.iconWrap} aria-hidden>
                <task.icon />
              </span>
              <span className={styles.taskTitle}>{task.title}</span>
              <span className={styles.reward}>
                <CoinIcon size={15} aria-hidden />
                {task.coinReward.toLocaleString('fa-IR')}
              </span>
              <button
                type="button"
                className={styles.checkBtn}
                onClick={() => onComplete(task.id)}
                disabled={done}
                aria-label={done ? `${task.title} انجام شد` : `انجام ${task.title}`}
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
