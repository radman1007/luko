import type { ComponentType, SVGProps } from 'react';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineFaceSmile,
  HiOutlineFlag,
  HiOutlineHandThumbUp,
  HiOutlineLightBulb,
  HiOutlineLockClosed,
  HiOutlineMoon,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import type { ParentTip, TipKind } from '../../types';
import styles from './TipsCard.module.css';

interface Props {
  tips: ParentTip[];
  childName: string;
  onUpgrade: () => void;
}

const TIP_ICON: Record<TipKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  practice: HiOutlineLightBulb,
  sleep: HiOutlineMoon,
  routine: HiOutlineClock,
  together: HiOutlineChatBubbleLeftRight,
  mood: HiOutlineFaceSmile,
  praise: HiOutlineHandThumbUp,
  goal: HiOutlineFlag,
};

/** «پیشنهادِ این هفته»: کارهای کوچک و عملی برای والد؛ بی‌اشتراک فقط اولی کامل است */
export function TipsCard({ tips, childName, onUpgrade }: Props) {
  const locked = tips.some((tip) => tip.locked);
  return (
    <section className={styles.card} aria-labelledby="tips-title">
      <header className={styles.head}>
        <span className={styles.badge} aria-hidden><HiOutlineSparkles /></span>
        <div>
          <h2 id="tips-title">پیشنهادِ این هفته</h2>
          <p>کارهای کوچکی که یادگیریِ {childName} را بهتر می‌کند</p>
        </div>
      </header>

      <ol className={styles.list}>
        {tips.map((tip) => {
          const Icon = TIP_ICON[tip.kind] ?? HiOutlineLightBulb;
          return (
            <li key={tip.id} className={styles.tip} data-locked={tip.locked || undefined}>
              <span className={styles.icon} aria-hidden><Icon /></span>
              <div className={styles.main}>
                <b>{tip.title}</b>
                {tip.locked ? (
                  <span className={styles.blur} aria-label="متنِ این پیشنهاد با اشتراک باز می‌شود">
                    <i /><i /><HiOutlineLockClosed aria-hidden />
                  </span>
                ) : (
                  <p>{tip.body}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {locked && (
        <button type="button" className={styles.more} onClick={onUpgrade}>
          دیدنِ همه‌ی پیشنهادهای شخصی با اشتراک
        </button>
      )}
    </section>
  );
}
