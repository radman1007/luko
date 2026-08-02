import {
  HiOutlineArrowTrendingDown,
  HiOutlineArrowTrendingUp,
  HiOutlineMinusSmall,
} from 'react-icons/hi2';
import type { SubjectProgressItem } from '../../types';
import styles from './SubjectProgress.module.css';

interface Props {
  items: SubjectProgressItem[];
}

const TREND_ICON = {
  up: HiOutlineArrowTrendingUp,
  flat: HiOutlineMinusSmall,
  down: HiOutlineArrowTrendingDown,
};

const TREND_TEXT = { up: 'رو به رشد', flat: 'ثابت', down: 'رو به افت' };

/** سطحِ تسلط: رنگِ نوار + برچسبِ متنی (رنگ هرگز تنها حاملِ معنا نیست) */
function level(mastery: number) {
  if (mastery >= 70) return { cls: styles.fillGood, text: 'خوب' };
  if (mastery >= 50) return { cls: styles.fillWatch, text: 'در حد انتظار' };
  return { cls: styles.fillWeak, text: 'نیاز به تمرین' };
}

/** تسلطِ بچه در هر درس — نوارِ درصد + تعدادِ بازی‌های انجام‌شده */
export function SubjectProgress({ items }: Props) {
  return (
    <ul className={styles.list}>
      {items.map((item) => {
        const state = level(item.mastery);
        const Trend = TREND_ICON[item.trend];

        return (
          <li key={item.key} className={styles.row}>
            <div className={styles.top}>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.value}>
                {item.mastery.toLocaleString('fa-IR')}
                <span className={styles.percent}>٪</span>
              </span>
            </div>

            <div className={styles.track}>
              <span className={state.cls} style={{ width: `${item.mastery}%` }} />
            </div>

            <div className={styles.meta}>
              <span className={styles.state}>{state.text}</span>
              <span className={styles.dot} aria-hidden>
                ·
              </span>
              <span>
                {item.gamesDone.toLocaleString('fa-IR')} از {item.gamesTotal.toLocaleString('fa-IR')} بازی
              </span>
              <span className={styles.trend}>
                <Trend size={13} aria-hidden />
                {TREND_TEXT[item.trend]}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
