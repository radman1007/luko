import type { ReactNode } from 'react';
import { HiOutlineLockClosed } from 'react-icons/hi2';
import { CrownIcon } from '@/components/ui/icons';
import type { ChildReport, HealthDaily } from '../../types';
import { TipsCard } from '../home/TipsCard';
import { DailyLocked } from './DailyLocked';
import { DayParts } from './DayParts';
import { InterestsCard } from './InterestsCard';
import { MoodHero } from './MoodHero';
import { MoodJourney } from './MoodJourney';
import { MoodSubjects } from './MoodSubjects';
import styles from './HealthPage.module.css';

interface Props {
  report: ChildReport;
  childName: string;
  onUpgrade: () => void;
  /** گالریِ نقاشی‌ها (پنلِ واقعی با API، مهمان بی‌API) */
  paintings?: ReactNode;
}

/**
 * صفحه‌ی سلامت — دو بخش:
 * «حالِ کلیِ هفته» برای همه (حکمِ ساده + یکی دو پیشنهاد) و «حالِ دقیقِ روزانه» فقط با اشتراک
 * (سفرِ حالِ روز، بخش‌های روز، درس‌ها، علاقه‌ها و پیشنهادهای بیشتر). هم‌شکلِ خانه.
 */
export function HealthPage({ report, childName, onUpgrade, paintings }: Props) {
  const health = report.health;
  if (!health) {
    return <p className={styles.waiting}>گزارشِ سلامتِ {childName} در حالِ آماده شدن است؛ چند لحظه‌ی دیگر دوباره سر بزنید.</p>;
  }
  const { weekly, daily } = health;
  const open = !('locked' in daily) ? (daily as HealthDaily) : null;

  return (
    <div className={styles.page} data-locked={open ? undefined : true}>
      <div className={styles.cell} data-area="hero">
        <MoodHero weekly={weekly} ai={report.ai} />
      </div>
      <div className={styles.cell} data-area="wtips">
        <TipsCard tips={weekly.tips} childName={childName} tone="rose" title="پیشنهادِ دکتر نیلا"
          subtitle={`برای حالِ بهترِ ${childName} در این هفته`} ai={report.ai} />
      </div>
      {paintings && <div className={styles.cell} data-area="art">{paintings}</div>}

      <header className={styles.section} data-area="dhead">
        <div>
          <h2>حالِ دقیقِ روزانه</h2>
          <p>
            {open
              ? `حالِ ${childName} در بخش‌های روز، کنارِ درس‌ها و علاقه‌هایش — ${open.range}`
              : `حالِ ${childName} در بخش‌های روز، کنارِ درس‌ها و علاقه‌هایش`}
          </p>
        </div>
        <span className={styles.badge} data-open={open ? true : undefined}>
          <CrownIcon size={14} strokeWidth={2} aria-hidden />
          {open ? 'با اشتراک' : 'ویژه‌ی اشتراک'}
        </span>
      </header>

      {open ? (
        <>
          <div className={styles.cell} data-area="journey"><MoodJourney days={open.journey} childName={childName} /></div>
          <div className={styles.cell} data-area="parts"><DayParts parts={open.parts} childName={childName} /></div>
          <div className={styles.cell} data-area="subjects"><MoodSubjects daily={open} childName={childName} /></div>
          <div className={styles.cell} data-area="interests"><InterestsCard daily={open} childName={childName} /></div>
          <div className={styles.cell} data-area="dtips">
            <TipsCard tips={open.tips} childName={childName} tone="rose" title="پیشنهادهای دقیقِ دکتر نیلا"
              subtitle={`بر اساسِ حالِ ${childName} در بخش‌های روز، درس‌ها و علاقه‌هایش`} ai={report.ai} />
          </div>
        </>
      ) : (
        <div className={styles.cell} data-area="locked">
          <DailyLocked teaser={'locked' in daily ? daily.teaser : { checkins: 0, parts: 0, subjects: 0, interests: 0, tips: 0 }}
            childName={childName} onUpgrade={onUpgrade} />
        </div>
      )}

      <p className={styles.privacy} data-area="privacy">
        <HiOutlineLockClosed aria-hidden />
        <span>
          نوشته‌های «صندوقچه‌ی رازها» رمزنگاری شده‌اند و برای هیچ‌کس — از جمله شما — قابلِ دیدن نیستند.
          این صفحه فقط از حال‌هایی ساخته می‌شود که {childName} خودش در لوکو گفته است.
        </span>
      </p>
    </div>
  );
}
