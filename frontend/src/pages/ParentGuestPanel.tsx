import { useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/context';
import { buildAnalysis } from '@/features/parent/analysis';
import type { Assignment } from '@/features/parent/api';
import type { ParentPreferences, Suggestion } from '@/features/parent/types';
import { ParentShell } from '@/features/parent/components/layout/ParentShell';
import { PanelPages } from '@/features/parent/components/layout/PanelPages';
import { usePanelPage } from '@/features/parent/components/layout/usePanelPage';
import { ChildSwitch } from '@/features/parent/components/shell/ChildSwitch';
import { Sheet } from '@/features/parent/components/shell/Sheet';
import { Toast } from '@/features/parent/components/shell/Toast';
import { AssistantPage } from '@/features/parent/components/assistant/AssistantPage';
import { DailyView } from '@/features/parent/components/views/DailyView';
import { SettingsPage } from '@/features/parent/components/settings/SettingsPage';
import { SettingsContext } from '@/features/parent/components/settings/SettingsContext';
import type { SettingsEnv } from '@/features/parent/components/settings/SettingsContext';
import { GUEST_NOTIFICATIONS } from '@/features/parent/components/settings/guestSettings';
import { localDate } from '@/features/parent/dates';
import {
  GUEST_ASSIGNMENTS,
  GUEST_CHILDREN,
  GUEST_PREFERENCES,
  GUEST_REPORTS,
  GUEST_SUGGESTIONS,
} from '@/features/parent/guestData';
import styles from './ParentPanel.module.css';

type SheetKind = 'logout';

/** پنلِ والدین در حالت مهمان؛ فقط داده‌ی نمونه دارد و هیچ APIای را صدا نمی‌زند. */
export default function ParentGuestPanel() {
  const { logout } = useAuth();
  const { page, section, sectionId, go } = usePanelPage();
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

  const demo = (message = 'این کار در حالتِ نمایشی انجام نمی‌شود') => setToast(message);
  const settingsEnv: SettingsEnv = {
    guest: true,
    parentName: 'مهمان',
    parentPhone: 'حالتِ نمایشی',
    phoneVerified: false,
    childList: GUEST_CHILDREN,
    activeChildId: child.id,
    onChildChange: setChildId,
    notifications: GUEST_NOTIFICATIONS,
    onReadAll: () => undefined,
    preferences,
    onToggle: togglePreference,
    onAddChild: () => demo('افزودن فرزند در حالتِ نمایشی فعال نیست'),
    onRemoveChild: () => demo('مدیریتِ فرزندان در حالتِ نمایشی فعال نیست'),
    onLogout: () => setSheet('logout'),
    onNotice: setToast,
    open: (next, id, extra) => go('settings', { s: next || undefined, id, ...extra }),
    follow: (link) => {
      const url = new URL(link, window.location.origin);
      const p = url.searchParams.get('p') ?? 'home';
      go(p as Parameters<typeof go>[0], { s: url.searchParams.get('s') ?? undefined, id: url.searchParams.get('id') ?? undefined });
    },
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
      onSubscription={() => go('settings', { s: 'billing' })}
      unread={0}
      onNotifications={() => go('settings', { s: 'notifications' })}
      onSupport={() => go('settings', { s: 'support' })}
      onLogout={() => setSheet('logout')}
      banner={
        <div className={styles.guestBanner} role="status">
          <b>حالت مهمان فعال است</b>
          <span>اطلاعات این صفحه نمونه است و در حسابی ذخیره نمی‌شود.</span>
        </div>
      }
      overlays={
        <>
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
        onUpgrade={() => go('settings', { s: 'billing' })}
        assistant={
          <AssistantPage guest childName={shortName} onUpgrade={() => go('settings', { s: 'billing' })}
            onSupport={() => go('settings', { s: 'support' })} onLogin={() => setSheet('logout')} />
        }
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
          <SettingsContext.Provider value={settingsEnv}>
            <SettingsPage section={section} id={sectionId} />
          </SettingsContext.Provider>
        }
      />
    </ParentShell>
  );
}
