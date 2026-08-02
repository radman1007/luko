import { useMemo, useState } from 'react';
import { HiOutlineCalendarDays } from 'react-icons/hi2';
import { useAuth } from '@/features/auth/context';
import { MOCK_CHILDREN, mockReport } from '@/features/parent/mockData';
import { AccuracyTrend } from '@/features/parent/components/AccuracyTrend/AccuracyTrend';
import { ActivityChart } from '@/features/parent/components/ActivityChart/ActivityChart';
import { AiInsightCard } from '@/features/parent/components/AiInsightCard/AiInsightCard';
import { ChildStrip } from '@/features/parent/components/ChildStrip/ChildStrip';
import { ComingSoonPanel } from '@/features/parent/components/ComingSoonPanel/ComingSoonPanel';
import { GamesTable } from '@/features/parent/components/GamesTable/GamesTable';
import { KpiRow } from '@/features/parent/components/KpiRow/KpiRow';
import { PanelCard } from '@/features/parent/components/PanelCard/PanelCard';
import { PanelHeader } from '@/features/parent/components/PanelHeader/PanelHeader';
import { PanelNav } from '@/features/parent/components/PanelNav/PanelNav';
import type { PanelView } from '@/features/parent/components/PanelNav/PanelNav';
import { SubjectProgress } from '@/features/parent/components/SubjectProgress/SubjectProgress';
import { WellbeingCard } from '@/features/parent/components/WellbeingCard/WellbeingCard';
import styles from './ParentPanel.module.css';

const VIEW_TITLE: Record<PanelView, string> = {
  dashboard: 'گزارش هفتگی',
  games: 'گزارش بازی‌ها',
  wellbeing: 'سلامت و روحیه',
  support: 'پشتیبانی',
  settings: 'تنظیمات',
};

export default function ParentPanel() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<PanelView>('dashboard');
  const [childId, setChildId] = useState(MOCK_CHILDREN[0].id);

  const child = MOCK_CHILDREN.find((item) => item.id === childId) ?? MOCK_CHILDREN[0];
  const report = useMemo(() => mockReport(childId), [childId]);

  return (
    <div className={styles.shell}>
      <PanelHeader user={user} onLogout={logout} />

      <div className={styles.body}>
        <PanelNav active={view} onChange={setView} />

        <main className={styles.main}>
          <ChildStrip items={MOCK_CHILDREN} selectedId={childId} onSelect={setChildId} />

          <div className={styles.pageHead}>
            <h1 className={styles.pageTitle}>
              {VIEW_TITLE[view]} <span className={styles.pageChild}>{child.firstName}</span>
            </h1>
            <span className={styles.range}>
              <HiOutlineCalendarDays size={15} aria-hidden />
              ۷ روز گذشته
            </span>
          </div>

          {view === 'dashboard' && (
            <div className={styles.stack}>
              <KpiRow items={report.kpis} />

              <div className={styles.twoCols}>
                <PanelCard
                  title="زمان فعالیت روزانه"
                  subtitle="دقیقه‌های فعالِ هر روز هفته؛ روی هر ستون نگه دارید تا جزئیات را ببینید."
                >
                  <ActivityChart data={report.week} />
                </PanelCard>
                <PanelCard title="روند دقت پاسخ‌ها" subtitle="درصد پاسخ‌های درست در هشت هفتهٔ گذشته.">
                  <AccuracyTrend data={report.accuracyTrend} />
                </PanelCard>
              </div>

              <div className={styles.twoCols}>
                <PanelCard title="تسلط در درس‌ها" subtitle="بر اساس امتیاز، دقت و تعداد بازی‌های کامل‌شدهٔ هر درس.">
                  <SubjectProgress items={report.subjects} />
                </PanelCard>
                <AiInsightCard insights={report.insights} childName={child.firstName} />
              </div>

              <PanelCard
                title="بازی‌های اخیر"
                subtitle="آمار ریز هر بازی: تلاش، دقت، زمان و تعداد راهنمایی‌ها."
                action={
                  <button type="button" className={styles.cardLink} onClick={() => setView('games')}>
                    همهٔ بازی‌ها
                  </button>
                }
              >
                <GamesTable games={report.games} limit={5} />
              </PanelCard>
            </div>
          )}

          {view === 'games' && (
            <PanelCard
              title={`همهٔ بازی‌های ${child.firstName}`}
              subtitle="برای پیدا کردن نقطه‌های ضعف، روی «کمترین دقت» مرتب کنید."
            >
              <GamesTable games={report.games} filterable />
            </PanelCard>
          )}

          {view === 'wellbeing' && (
            <PanelCard title="حال و روحیه" subtitle="خلاصهٔ ثبت حال و فعالیت‌های لوکو سلامت در دو هفتهٔ گذشته.">
              <WellbeingCard moods={report.moods} wellbeing={report.wellbeing} />
            </PanelCard>
          )}

          {view === 'support' && (
            <ComingSoonPanel
              title="پشتیبانی و تیکت"
              description="ثبت تیکت، پیگیری پاسخ‌ها و گفتگو با تیم لوکو در همین بخش اضافه می‌شود."
            />
          )}

          {view === 'settings' && (
            <ComingSoonPanel
              title="تنظیمات حساب"
              description="مدیریت شمارهٔ تماس، محدودیت زمان استفادهٔ فرزند و تنظیم یادآورها در این بخش قرار می‌گیرد."
            />
          )}
        </main>
      </div>
    </div>
  );
}
