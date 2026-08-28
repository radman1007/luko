import { HiOutlineCheckCircle, HiOutlinePause, HiOutlineXMark } from 'react-icons/hi2';
import { CoinIcon } from '@/components/ui/icons';
import { LUKORIANS } from '@/lib/characters';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useSportSession } from '../../useSportSession';
import type { SportTask } from '../../types';
import styles from './SportSession.module.css';

interface Props {
  task: SportTask;
  onClose: () => void;
}

const RING = 2 * Math.PI * 52;   // محیطِ حلقه‌ی پیشرفت (r = 52)

/**
 * تمرینِ هدایت‌شده‌ی چابک: اپ ریتم و شمارش را نگه می‌دارد و پایانش
 * خودکار امتیاز می‌دهد. هیچ دکمه‌ی «انجام دادم»ی در کار نیست.
 */
export function SportSession({ task, onClose }: Props) {
  const champ = LUKORIANS.sport;
  const { phase, secondsLeft, progress, repDone } = useSportSession(task);
  useEscapeKey(onClose);

  const done = phase === 'done';

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label={task.title}>
      <div className={styles.card}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="بستن">
          <HiOutlineXMark />
        </button>

        <img className={styles.character} src={champ.image} alt={champ.name} />
        <h2 className={styles.title}>{task.title}</h2>

        <div className={styles.ringWrap}>
          <svg className={styles.ring} viewBox="0 0 120 120" aria-hidden>
            <circle className={styles.ringBase} cx="60" cy="60" r="52" />
            <circle
              className={styles.ringFill}
              cx="60"
              cy="60"
              r="52"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
            />
          </svg>

          <div className={styles.center}>
            {done ? (
              <HiOutlineCheckCircle className={styles.tick} aria-hidden />
            ) : repDone !== undefined ? (
              <>
                <b className={styles.big}>{repDone.toLocaleString('fa-IR')}</b>
                <span className={styles.unit}>از {task.reps?.toLocaleString('fa-IR')}</span>
              </>
            ) : (
              <>
                <b className={styles.big}>{secondsLeft.toLocaleString('fa-IR')}</b>
                <span className={styles.unit}>ثانیه</span>
              </>
            )}
          </div>
        </div>

        {done ? (
          <>
            <p className={styles.cue}>ایول! تمرین رو تا آخر رفتی.</p>
            <p className={styles.earned}>
              <CoinIcon size={18} aria-hidden />+{task.coinReward.toLocaleString('fa-IR')} سکه
            </p>
            <button type="button" className={styles.primary} onClick={onClose}>
              باشه
            </button>
          </>
        ) : phase === 'paused' ? (
          <p className={styles.paused}>
            <HiOutlinePause aria-hidden />
            برگرد به صفحه تا تمرین ادامه پیدا کنه
          </p>
        ) : (
          <p className={styles.cue}>{task.cue}</p>
        )}
      </div>
    </div>
  );
}
