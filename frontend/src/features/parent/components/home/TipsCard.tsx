import type { ComponentType, SVGProps } from 'react';
import { useId } from 'react';
import {
  HiOutlineChatBubbleLeftRight,
  HiOutlineClock,
  HiOutlineFaceSmile,
  HiOutlineFlag,
  HiOutlineHandThumbUp,
  HiOutlineLightBulb,
  HiOutlineLockClosed,
  HiOutlineMoon,
  HiOutlinePaintBrush,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { BreathIcon } from './BreathIcon';
import type { AiStatus, ParentTip, TipKind } from '../../types';
import { AiBadge } from '../ai/AiBadge';
import styles from './TipsCard.module.css';

interface Props {
  tips: ParentTip[];
  childName: string;
  /** فقط وقتی پیشنهادِ قفل هست لازم است */
  onUpgrade?: () => void;
  /** پیش‌فرض: «پیشنهادِ این هفته» در خانه */
  title?: string;
  subtitle?: string;
  /** رنگِ نشانِ بالای کارت: آفتابی (خانه) یا گلی (سلامت) */
  tone?: 'sun' | 'rose';
  /** وضعیتِ تحلیلِ هوشمندِ گزارش؛ نشان فقط وقتی که همین پیشنهادها را مدل نوشته باشد */
  ai?: AiStatus;
}

const TIP_ICON: Record<TipKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  practice: HiOutlineLightBulb,
  sleep: HiOutlineMoon,
  routine: HiOutlineClock,
  together: HiOutlineChatBubbleLeftRight,
  mood: HiOutlineFaceSmile,
  praise: HiOutlineHandThumbUp,
  goal: HiOutlineFlag,
  breath: BreathIcon,
  art: HiOutlinePaintBrush,
};

/** فهرستِ پیشنهادها برای والد: کارهای کوچک و عملی؛ بی‌اشتراک فقط اولی کامل است */
export function TipsCard({ tips, childName, onUpgrade, title, subtitle, tone = 'sun', ai }: Props) {
  const written = tips.some((tip) => tip.id.startsWith('ai'));
  const locked = tips.some((tip) => tip.locked);
  const headingId = useId();
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <header className={styles.head}>
        <span className={styles.badge} data-tone={tone} aria-hidden><HiOutlineSparkles /></span>
        <div className={styles.headText}>
          <div className={styles.titleRow}>
            <h2 id={headingId}>{title ?? 'پیشنهادِ این هفته'}</h2>
            <AiBadge ai={ai} written={written} />
          </div>
          <p>{subtitle ?? `کارهای کوچکی که یادگیریِ ${childName} را بهتر می‌کند`}</p>
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

      {locked && onUpgrade && (
        <button type="button" className={styles.more} onClick={onUpgrade}>
          دیدنِ همه‌ی پیشنهادهای شخصی با اشتراک
        </button>
      )}
    </section>
  );
}
