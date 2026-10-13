import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiOutlineInformationCircle,
  HiOutlinePaperAirplane,
  HiOutlineShieldCheck,
} from 'react-icons/hi2';
import { useAuth } from '@/features/auth/context';
import { buildAnalysis } from '@/features/parent/analysis';
import type { Assignment } from '@/features/parent/api';
import type { ParentPreferences, Suggestion } from '@/features/parent/types';
import { ParentShell } from '@/features/parent/components/layout/ParentShell';
import { PanelPages } from '@/features/parent/components/layout/PanelPages';
import { usePanelPage } from '@/features/parent/components/layout/usePanelPage';
import { Card } from '@/features/parent/components/shell/Card';
import { ChildSwitch } from '@/features/parent/components/shell/ChildSwitch';
import { Sheet } from '@/features/parent/components/shell/Sheet';
import { Toast } from '@/features/parent/components/shell/Toast';
import { DailyView } from '@/features/parent/components/views/DailyView';
import { SettingsView } from '@/features/parent/components/views/SettingsView';
import { localDate } from '@/features/parent/dates';
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
  const navigate = useNavigate();
  const { page, go } = usePanelPage();
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
  const today = childAssignments.find((item) => item.date === localDate(0)) ?? null;
  const childPage = page === 'home' || page === 'health' || page === 'details' || page === 'daily';

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
    <ParentShell
      page={page}
      onNavigate={go}
      parentName="مهمان"
      parentPhone="دموی بدون حساب"
      childList={GUEST_CHILDREN}
      activeChildId={child.id}
      onChildChange={setChildId}
      onAddChild={() => setToast('افزودن فرزند در حالت مهمان فعال نیست')}
      childName={shortName}
      onSubscription={() => navigate(`/parent-panel/subscription?child=${child.id}`)}
      unread={0}
      onNotifications={() => setSheet('notifications')}
      onSupport={() => setSheet('support')}
      onLogout={() => setSheet('logout')}
      banner={
        <div className={styles.guestBanner} role="status">
          <b>حالت مهمان فعال است</b>
          <span>اطلاعات این صفحه نمونه است و در حسابی ذخیره نمی‌شود.</span>
        </div>
      }
      overlays={
        <>
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
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => {
                setSheet(null);
                setToast('این گزینه در نسخهٔ دمو ارسال نمی‌شود');
              }}
            >
              <HiOutlinePaperAirplane aria-hidden /> ارسال پیام نمونه
            </button>
          </Sheet>

          <Sheet open={sheet === 'privacy'} title="حریم خصوصی و امنیت" onClose={() => setSheet(null)}>
            <p className={styles.sheetText}>
              <HiOutlineShieldCheck aria-hidden /> در حالت مهمان، هیچ اطلاعاتی از شما یا فرزندتان به سرور ارسال نمی‌شود.
            </p>
          </Sheet>

          <Sheet open={sheet === 'about'} title="دربارهٔ لوکو" onClose={() => setSheet(null)}>
            <p className={styles.sheetText}>
              <HiOutlineInformationCircle aria-hidden /> این صفحه یک دمو برای نمایشگاه است و داده‌های آن واقعی نیست.
            </p>
          </Sheet>

          <Sheet open={sheet === 'logout'} title="خروج از حالت مهمان" onClose={() => setSheet(null)}>
            <p className={styles.sheetText}>با خروج، حالت مهمان این دستگاه پاک می‌شود.</p>
            <div className={styles.btnRow}>
              <button type="button" className={styles.btnDanger} onClick={logout}>خروج</button>
              <button type="button" className={styles.btnGhost} onClick={() => setSheet(null)}>انصراف</button>
            </div>
          </Sheet>

          <Toast message={toast} onDone={() => setToast(null)} />
        </>
      }
    >
      {childPage && (
        <div className={styles.mobileOnly}>
          <ChildSwitch items={GUEST_CHILDREN} activeId={child.id} onChange={setChildId} />
        </div>
      )}
      <PanelPages
        page={page}
        onNavigate={go}
        report={report}
        analysis={analysis}
        childName={shortName}
        today={today}
        onUpgrade={() => navigate(`/parent-panel/subscription?child=${child.id}`)}
        onSupport={() => setSheet('support')}
        daily={
          <DailyView
            childName={shortName}
            suggestions={GUEST_SUGGESTIONS}
            currentSlug={today?.gameSlug ?? null}
            assignments={childAssignments}
            saving={false}
            onPick={pickGame}
          />
        }
        settings={
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
        }
      />
    </ParentShell>
  );
}
