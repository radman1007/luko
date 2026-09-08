import { useMemo, useState } from 'react';
import {
  HiOutlineBell,
  HiOutlineInformationCircle,
  HiOutlinePaperAirplane,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';
import { BrandMark } from '@/components/ui/icons';
import { useAuth } from '@/features/auth/context';
import { buildAnalysis } from '@/features/parent/analysis';
import type { Assignment } from '@/features/parent/api';
import type { ParentPreferences, Suggestion } from '@/features/parent/types';
import { BottomNav } from '@/features/parent/components/shell/BottomNav';
import type { PanelTab } from '@/features/parent/components/shell/BottomNav';
import { Card } from '@/features/parent/components/shell/Card';
import { ChildSwitch } from '@/features/parent/components/shell/ChildSwitch';
import { Sheet } from '@/features/parent/components/shell/Sheet';
import { Toast } from '@/features/parent/components/shell/Toast';
import { DashboardView } from '@/features/parent/components/views/DashboardView';
import { DailyView } from '@/features/parent/components/views/DailyView';
import { HealthView } from '@/features/parent/components/views/HealthView';
import { ReportsView } from '@/features/parent/components/views/ReportsView';
import { SettingsView } from '@/features/parent/components/views/SettingsView';
import {
  GUEST_ASSIGNMENTS,
  GUEST_CHILDREN,
  GUEST_PREFERENCES,
  GUEST_REPORTS,
  GUEST_SUGGESTIONS,
} from '@/features/parent/guestData';
import styles from './ParentPanel.module.css';

type SheetKind = 'notifications' | 'support' | 'privacy' | 'about' | 'logout';

/** پنلِ والدین در حالت مهمان؛ فقط داده‌ی نمونه دارد و هیچ APIای را صدا نمی‌زند. */
export default function ParentGuestPanel() {
  const { logout } = useAuth();
  const [tab, setTab] = useState<PanelTab>('dashboard');
  const [childId, setChildId] = useState(GUEST_CHILDREN[0].id);
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<ParentPreferences>(GUEST_PREFERENCES);
  const [assignments, setAssignments] = useState<Record<string, Assignment[]>>(GUEST_ASSIGNMENTS);

  const child = GUEST_CHILDREN.find((item) => item.id === childId) ?? GUEST_CHILDREN[0];
  const report = GUEST_REPORTS[child.id];
  const childName = `${child.firstName} ${child.lastName}`.trim() || 'فرزند شما';
  const shortName = child.firstName || childName;
  const analysis = useMemo(() => buildAnalysis(report, shortName), [report, shortName]);
  const childAssignments = assignments[child.id] ?? [];
  const currentAssignment = childAssignments.find((item) => item.date === localDate(0));

  const pickGame = (item: Suggestion, date: string) => {
    setAssignments((current) => ({
      ...current,
      [child.id]: [
        ...(current[child.id] ?? []).filter((assignment) => assignment.date !== date),
        {
          id: Date.now(),
          gameSlug: item.slug,
          gameTitle: item.title,
          bookTitle: item.bookTitle,
          date,
          note: '',
          played: false,
        },
      ],
    }));
    setToast(`بازی «${item.title}» برای ${shortName} ثبت شد`);
  };

  const togglePreference = (key: keyof ParentPreferences, value: boolean) => {
    setPreferences((current) => ({ ...current, [key]: value }));
    setToast(value ? 'این اعلان در حالت دمو روشن شد' : 'این اعلان در حالت دمو خاموش شد');
  };

  return (
    <div className={styles.app}>
      <header className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden>
            <BrandMark size={22} />
          </span>
          <span className={styles.brandText}>
            <b>لوکو</b>
            <small>پنل والدین</small>
          </span>
        </div>

        <div className={styles.barActions}>
          <button type="button" className={styles.iconBtn} onClick={() => setSheet('notifications')} aria-label="اعلان‌ها">
            <HiOutlineBell aria-hidden />
          </button>
          <div className={styles.userChip}>
            <span className={styles.userText}>
              <b>مهمان</b>
              <small>دموی بدون حساب</small>
            </span>
            <span className={styles.userAvatar} aria-hidden>م</span>
          </div>
        </div>
      </header>

      <div className={styles.guestBanner} role="status">
        <b>حالت مهمان فعال است</b>
        <span>اطلاعات این صفحه نمونه است و در حسابی ذخیره نمی‌شود.</span>
      </div>

      <main className={styles.main}>
        <div className={styles.view} key={tab}>
          {tab !== 'settings' && (
            <ChildSwitch items={GUEST_CHILDREN} activeId={child.id} onChange={setChildId} />
          )}

          {tab === 'dashboard' && (
            <DashboardView report={report} analysis={analysis} childName={shortName} onGoDaily={() => setTab('daily')} />
          )}
          {tab === 'reports' && <ReportsView report={report} />}
          {tab === 'daily' && (
            <DailyView
              childName={shortName}
              suggestions={GUEST_SUGGESTIONS}
              currentSlug={currentAssignment?.gameSlug ?? null}
              assignments={childAssignments}
              saving={false}
              onPick={pickGame}
            />
          )}
          {tab === 'health' && <HealthView report={report} childName={shortName} />}
          {tab === 'settings' && (
            <SettingsView
              parentName="مهمان"
              parentPhone="دموی بدون حساب"
              childList={GUEST_CHILDREN}
              preferences={preferences}
              onToggle={togglePreference}
              onAddChild={() => setToast('افزودن فرزند در حالت مهمان فعال نیست')}
              onRemoveChild={() => setToast('مدیریت فرزندان در حالت مهمان فعال نیست')}
              onSupport={() => setSheet('support')}
              onPrivacy={() => setSheet('privacy')}
              onAbout={() => setSheet('about')}
              onNotice={() => undefined}
          onLogout={() => setSheet('logout')}
            />
          )}
        </div>
      </main>

      <BottomNav tab={tab} onChange={setTab} />

      <Sheet open={sheet === 'notifications'} title="اعلان‌ها" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>در این نسخهٔ نمایشی، دو اعلان نمونه برای آشنایی با پنل آماده شده است.</p>
        <Card>
          <b>گزارش هفتگی آماده است</b>
          <p className={styles.sheetText}>آرش این هفته ۴۵ دقیقه بازی کرده است.</p>
        </Card>
        <Card>
          <b>یک بازی برای امروز پیشنهاد شده</b>
          <p className={styles.sheetText}>الگویاب برای تمرینِ مبحث الگو مناسب است.</p>
        </Card>
      </Sheet>

      <Sheet open={sheet === 'support'} title="گفتگو با پشتیبانی" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>پشتیبانی در حالت مهمان فقط برای نمایش ظاهر پنل است.</p>
        <button type="button" className={styles.btnPrimary} onClick={() => { setSheet(null); setToast('این گزینه در نسخهٔ دمو ارسال نمی‌شود'); }}>
          <HiOutlinePaperAirplane aria-hidden /> ارسال پیام نمونه
        </button>
      </Sheet>

      <Sheet open={sheet === 'privacy'} title="حریم خصوصی و امنیت" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}><HiOutlineShieldCheck aria-hidden /> در حالت مهمان، هیچ اطلاعاتی از شما یا فرزندتان به سرور ارسال نمی‌شود.</p>
      </Sheet>

      <Sheet open={sheet === 'about'} title="دربارهٔ لوکو" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}><HiOutlineInformationCircle aria-hidden /> این صفحه یک دمو برای نمایشگاه است و داده‌های آن واقعی نیست.</p>
      </Sheet>

      <Sheet open={sheet === 'logout'} title="خروج از حالت مهمان" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>با خروج، حالت مهمان این دستگاه پاک می‌شود.</p>
        <div className={styles.btnRow}>
          <button type="button" className={styles.btnDanger} onClick={logout}>خروج</button>
          <button type="button" className={styles.btnGhost} onClick={() => setSheet(null)}>انصراف</button>
        </div>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

function localDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
