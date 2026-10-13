import type { Assignment } from '../../api';
import type { ChildReport } from '../../types';
import type { PanelPage } from '../layout/nav';
import { DailyCard } from './DailyCard';
import { ExploreGrid } from './ExploreGrid';
import { SubjectsCard } from './SubjectsCard';
import { TipsCard } from './TipsCard';
import { WeeklyHero } from './WeeklyHero';
import styles from './HomeView.module.css';

interface Props {
  report: ChildReport;
  childName: string;
  today: Assignment | null;
  onNavigate: (page: PanelPage) => void;
  onUpgrade: () => void;
}

/**
 * خانه‌ی پنلِ والدین: گزارشِ هفتگی، بازیِ امروز، وضعیتِ درس‌ها، پیشنهادِ این هفته و معرفیِ
 * بخش‌های دیگر. هر بخش کوتاه و قابلِ‌فهم؛ جزئیاتِ کامل در «گزارشِ کامل».
 */
export function HomeView({ report, childName, today, onNavigate, onUpgrade }: Props) {
  return (
    <div className={styles.home}>
      {report.weekly && (
        <div className={styles.cell} data-area="hero">
          <WeeklyHero weekly={report.weekly} childName={childName}
            onDetails={() => onNavigate('details')} onDaily={() => onNavigate('daily')} />
        </div>
      )}
      {/* هفته‌ی بی‌فعالیت خودش به «انتخابِ بازیِ امروز» دعوت می‌کند؛ کارتِ خالیِ دوم تکرار است */}
      {(today || report.weekly?.active !== false) && (
        <div className={styles.cell} data-area="daily">
          <DailyCard childName={childName} today={today} onOpen={() => onNavigate('daily')} />
        </div>
      )}
      <div className={styles.cell} data-area="subjects">
        <SubjectsCard subjects={report.subjects} childName={childName} onUpgrade={onUpgrade} />
      </div>
      {report.tips && report.tips.items.length > 0 && (
        <div className={styles.cell} data-area="tips">
          <TipsCard tips={report.tips.items} childName={childName} onUpgrade={onUpgrade} />
        </div>
      )}
      <div className={styles.cell} data-area="explore">
        <ExploreGrid childName={childName} wellbeing={report.wellbeing} moodWeek={report.health?.weekly}
          onNavigate={onNavigate} />
      </div>
      <p className={styles.foot}>
        همه‌ی عددها از بازی‌هایی می‌آید که {childName} واقعاً انجام داده؛ هیچ عددی حدسی نیست.
      </p>
    </div>
  );
}
