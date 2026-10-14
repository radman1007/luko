import type { ReactNode } from 'react';
import type { ChildAnalysis } from '../../analysis';
import type { Assignment } from '../../api';
import type { ChildReport } from '../../types';
import { HealthPage } from '../health/HealthPage';
import { HomeView } from '../home/HomeView';
import { DashboardView } from '../views/DashboardView';
import { PlanNote } from '../views/PlanNote';
import { ReportsView } from '../views/ReportsView';
import { SubPage } from '../views/SubPage';
import type { PanelPage } from './nav';

interface Props {
  page: PanelPage;
  onNavigate: (page: PanelPage) => void;
  report?: ChildReport;
  analysis?: ChildAnalysis | null;
  childName: string;
  today: Assignment | null;
  onUpgrade: () => void;
  /** «بازیِ امروز»، دستیار و تنظیمات بینِ پنلِ واقعی و مهمان فرق دارند؛ از بیرون می‌آیند */
  daily: ReactNode;
  settings: ReactNode;
  assistant: ReactNode;
  learn: ReactNode;
  /** بارگذاری، خطا یا «فرزندی نیست» برای صفحه‌هایی که به گزارشِ فرزند نیاز دارند */
  status?: ReactNode;
}

/** محتوای هر صفحه‌ی پنل — مشترک بینِ پنلِ والد و حالتِ نمایشیِ مهمان */
export function PanelPages({
  page, onNavigate, report, analysis, childName, today, onUpgrade, daily, settings, assistant, learn, status,
}: Props) {
  if (page === 'settings') return <>{settings}</>;
  // کتابخانه بی‌فرزند هم باز است (پیشنهادِ «برای فرزندتان» فقط وقتی فرزند هست)
  if (page === 'learn') return <>{learn}</>;
  if (status) return <>{status}</>;
  // دستیار به گزارش نیاز ندارد (خودش گفت‌وگو را می‌خواند)، فقط به فرزند
  if (page === 'assistant') return <>{assistant}</>;
  if (page === 'daily') {
    return (
      <SubPage title={`بازی روزِ ${childName}`} note="بچه وقتی وارد لوکو شود اول همین بازی را می‌بیند."
        onBack={() => onNavigate('home')}>
        {daily}
      </SubPage>
    );
  }
  if (!report) return null;
  if (page === 'health') return <HealthPage report={report} childName={childName} onUpgrade={onUpgrade} />;
  if (page === 'details') {
    return (
      <SubPage title={`گزارشِ کاملِ ${childName}`} note="همه‌ی آمار، روند و جلسه‌های بازی"
        onBack={() => onNavigate('home')}>
        {report.premium === false && (
          <PlanNote childName={childName} lockedGames={report.lockedGames} onUpgrade={onUpgrade} />
        )}
        {analysis && (
          <DashboardView report={report} analysis={analysis} childName={childName}
            onGoDaily={() => onNavigate('daily')} />
        )}
        <ReportsView report={report} />
      </SubPage>
    );
  }
  return <HomeView report={report} childName={childName} today={today} onNavigate={onNavigate} onUpgrade={onUpgrade} />;
}
