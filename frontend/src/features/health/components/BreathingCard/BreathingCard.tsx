import { HiOutlinePlay, HiOutlineStop } from 'react-icons/hi2';
import { useBreathing } from '../../useBreathing';
import type { BreathPhase } from '../../useBreathing';
import styles from './BreathingCard.module.css';

const PHASE_TEXT: Record<BreathPhase, string> = {
  rest: 'آماده‌ای؟',
  inhale: 'نفس بکش تو…',
  hold: 'نگهش دار…',
  exhale: 'آروم بده بیرون…',
};

export function BreathingCard() {
  const { phase, secondsLeft, cyclesDone, running, start, stop } = useBreathing();

  return (
    <section className={styles.card} aria-label="تمرین تنفس">
      <h2 className={styles.title}>نفس جادویی</h2>
      <p className={styles.subtitle}>با دکتر نیلا نفس عمیق تمرین کن تا آروم بشی</p>

      <div className={styles.stage}>
        <div className={`${styles.circle} ${styles[phase]}`}>
          <span className={styles.phaseText}>{PHASE_TEXT[phase]}</span>
          {running && <span className={styles.counter}>{secondsLeft.toLocaleString('fa-IR')}</span>}
        </div>
      </div>

      <div className={styles.footer}>
        {cyclesDone > 0 && (
          <span className={styles.cycles}>{cyclesDone.toLocaleString('fa-IR')} دور کامل شد</span>
        )}
        <button type="button" className={styles.action} onClick={running ? stop : start}>
          {running ? <HiOutlineStop aria-hidden /> : <HiOutlinePlay aria-hidden />}
          {running ? 'کافیه' : 'شروع تمرین'}
        </button>
      </div>
    </section>
  );
}
