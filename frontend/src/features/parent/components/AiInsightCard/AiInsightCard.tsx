import {
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlineLightBulb,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import type { Insight } from '../../types';
import styles from './AiInsightCard.module.css';

interface Props {
  insights: Insight[];
  childName: string;
}

const TONE = {
  good: { Icon: HiOutlineCheckCircle, cls: styles.iconGood },
  watch: { Icon: HiOutlineExclamationTriangle, cls: styles.iconWatch },
  tip: { Icon: HiOutlineLightBulb, cls: styles.iconTip },
};

/**
 * تحلیلِ هوشمند — متن‌ها فعلاً نمونه‌اند؛ در گامِ بعد از رویدادهای واقعیِ
 * بازی‌ها (GameEvent در بک‌اند) توسط مدل تولید می‌شوند.
 */
export function AiInsightCard({ insights, childName }: Props) {
  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <span className={styles.mark} aria-hidden>
          <HiOutlineSparkles size={18} />
        </span>
        <div className={styles.titles}>
          <h2 className={styles.title}>تحلیل هوشمند</h2>
          <p className={styles.subtitle}>خلاصهٔ هفتهٔ {childName} از دید دستیار لوکو</p>
        </div>
        <span className={styles.badge}>نمونه</span>
      </header>

      <ul className={styles.list}>
        {insights.map((insight) => {
          const { Icon, cls } = TONE[insight.tone];
          return (
            <li key={insight.id} className={styles.item}>
              <span className={cls} aria-hidden>
                <Icon size={16} />
              </span>
              <div>
                <b className={styles.itemTitle}>{insight.title}</b>
                <p className={styles.itemBody}>{insight.body}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <footer className={styles.foot}>
        <button type="button" className={styles.action} disabled>
          ساخت تحلیل تازه
        </button>
        <p className={styles.note}>
          تولید خودکارِ تحلیل و نمودارها بعد از اتصال گزارش‌ها به سرور فعال می‌شود.
        </p>
      </footer>
    </section>
  );
}
