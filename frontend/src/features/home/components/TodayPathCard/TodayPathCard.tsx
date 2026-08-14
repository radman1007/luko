import { useNavigate } from 'react-router-dom';
import type { ComponentType } from 'react';
import {
  HiOutlineBolt,
  HiOutlineCheck,
  HiOutlineChevronLeft,
  HiOutlineFaceSmile,
  HiOutlineFire,
  HiOutlineTrophy,
} from 'react-icons/hi2';
import { SproutIcon } from '@/components/ui/icons';
import styles from './TodayPathCard.module.css';

interface Props {
  missionsDone: boolean;
  sportDone: boolean;
  moodDone: boolean;
  gardenDone: boolean;
  streak: number;
  /** باز کردنِ مودالِ ثبتِ حال — چون صفحه‌ی جدا ندارد */
  onMood: () => void;
}

interface Step {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  color: string;
  done: boolean;
  go: () => void;
}

/**
 * مسیرِ امروز — چهار کارِ روزانه روی یک مسیر.
 * وضعیتِ هرکدام از دادهٔ واقعیِ همان بخش می‌آید، نه شمارنده‌ی جدا.
 */
export function TodayPathCard(props: Props) {
  const navigate = useNavigate();

  const steps: Step[] = [
    { key: 'mission', label: 'مأموریت', icon: HiOutlineTrophy, color: '#2e9e5b',
      done: props.missionsDone, go: () => navigate('/luko-club') },
    { key: 'mood', label: 'حال دل', icon: HiOutlineFaceSmile, color: '#4696e5',
      done: props.moodDone, go: props.onMood },
    { key: 'sport', label: 'ورزش', icon: HiOutlineBolt, color: '#e0454a',
      done: props.sportDone, go: () => navigate('/luko-club') },
    { key: 'garden', label: 'باغچه', icon: SproutIcon, color: '#6f9455',
      done: props.gardenDone, go: () => navigate('/garden') },
  ];

  const doneCount = steps.filter((step) => step.done).length;
  const next = steps.find((step) => !step.done);

  return (
    <section className={styles.card} aria-label="مسیر امروز">
      <div className={styles.head}>
        <h2 className={styles.title}>مسیر امروزت</h2>
        <span className={styles.streak}>
          <HiOutlineFire aria-hidden />
          {props.streak.toLocaleString('fa-IR')} روز پیاپی
        </span>
      </div>

      <div className={styles.path}>
        <span className={styles.line} aria-hidden />
        {steps.map(({ key, label, icon: Icon, color, done, go }) => (
          <button
            key={key}
            type="button"
            className={styles.step}
            onClick={go}
            aria-label={`${label}${done ? ' — انجام شد' : ''}`}
          >
            <span
              className={done ? styles.nodeDone : styles.node}
              style={{ '--node': color } as React.CSSProperties}
            >
              {done ? <HiOutlineCheck aria-hidden /> : <Icon aria-hidden />}
            </span>
            <span className={done ? styles.labelDone : styles.label}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.foot}>
        <p className={styles.summary}>
          {doneCount === steps.length
            ? 'همه‌ی کارهای امروز تمومه! فردا دوباره می‌بینمت.'
            : `${doneCount.toLocaleString('fa-IR')} از ${steps.length.toLocaleString('fa-IR')} کارِ امروز انجام شده.`}
        </p>
        {next && (
          <button type="button" className={styles.cta} onClick={next.go}>
            بریم سراغ {next.label}
            <HiOutlineChevronLeft aria-hidden />
          </button>
        )}
      </div>
    </section>
  );
}
