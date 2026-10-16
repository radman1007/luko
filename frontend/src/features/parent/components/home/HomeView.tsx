import type { ChildReport } from '../../types';
import type { PanelPage } from '../layout/nav';
import { SubjectsCard } from './SubjectsCard';
import { TipsCard } from './TipsCard';
import { WeeklyHero } from './WeeklyHero';
import styles from './HomeView.module.css';

interface Props {
  report: ChildReport;
  childName: string;
  onNavigate: (page: PanelPage) => void;
  onUpgrade: () => void;
}

/**
 * خانه‌ی پنلِ والدین: گزارشِ هفتگی، وضعیتِ درس‌ها و پیشنهادِ این هفته. کارت‌های «بازیِ امروز»، «سلامت و
 * حال‌ودل»، «دستیارِ هوشمند» و «آموزشِ والدین» به خواستِ کاربر (۲۵ مهر ۱۴۰۵) از خانه برداشته شدند؛ هرکدام در
 * منوی خودش است. «جزئیاتِ بیشتر» در نسخه‌ی رایگان قفل است.
 */
export function HomeView({ report, childName, onNavigate, onUpgrade }: Props) {
  const locked = report.premium === false;
  return (
    <div className={styles.home}>
      {report.weekly && (
        <div className={styles.cell} data-area="hero">
          <WeeklyHero weekly={report.weekly} childName={childName} ai={report.ai} locked={locked}
            onDetails={() => (locked ? onUpgrade() : onNavigate('details'))} onDaily={() => onNavigate('daily')} />
        </div>
      )}
      <div className={styles.cell} data-area="subjects">
        <SubjectsCard subjects={report.subjects} childName={childName} onUpgrade={onUpgrade} />
      </div>
      {report.tips && report.tips.items.length > 0 && (
        <div className={styles.cell} data-area="tips">
          <TipsCard tips={report.tips.items} childName={childName} onUpgrade={onUpgrade} ai={report.ai} />
        </div>
      )}
      <p className={styles.foot}>
        همه‌ی عددها از بازی‌هایی می‌آید که {childName} واقعاً انجام داده؛ هیچ عددی حدسی نیست.
      </p>
    </div>
  );
}
