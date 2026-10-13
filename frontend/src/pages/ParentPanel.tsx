import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { useAuth } from '@/features/auth/context';
import ParentGuestPanel from './ParentGuestPanel';
import { buildAnalysis } from '@/features/parent/analysis';
import type { Child, ParentPreferences, Suggestion } from '@/features/parent/types';
import {
  useAddChild,
  useAssignments,
  useChildren,
  useMarkNotificationsRead,
  useNotifications,
  usePreferences,
  useRemoveChild,
  useReport,
  useSetAssignment,
  useSetPreferences,
  useSuggestions,
} from '@/features/parent/useParent';
import { ParentShell } from '@/features/parent/components/layout/ParentShell';
import { PanelPages } from '@/features/parent/components/layout/PanelPages';
import { usePanelPage } from '@/features/parent/components/layout/usePanelPage';
import { ChildSwitch } from '@/features/parent/components/shell/ChildSwitch';
import { Sheet } from '@/features/parent/components/shell/Sheet';
import { Toast } from '@/features/parent/components/shell/Toast';
import { ParentIntroGate } from '@/features/parent/components/intro/ParentIntroGate';
import { useSubscriptions } from '@/features/billing/useBilling';
import { DailyView } from '@/features/parent/components/views/DailyView';
import { SettingsPage } from '@/features/parent/components/settings/SettingsPage';
import { SettingsContext } from '@/features/parent/components/settings/SettingsContext';
import type { SettingsEnv } from '@/features/parent/components/settings/SettingsContext';
import { localDate } from '@/features/parent/dates';
import { isValidPhone, normalizePhone } from '@/lib/phone';
import { ALL_GRADES, gradeName } from '@/lib/grades';
import { useOpenGrades } from '@/features/games/useOpenGrades';
import styles from './ParentPanel.module.css';

type SheetKind = 'addChild' | 'removeChild' | 'logout';

/** اسکلتِ بارگذاری — شکلِ خانه را نگه می‌دارد تا صفحه نپرد */
function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden>
      <div className={styles.skelHero} />
      <div className={styles.skelRow} />
      <div className={styles.skelGrid}>
        <div className={styles.skelCard} />
        <div className={styles.skelCard} />
      </div>
    </div>
  );
}

function AuthenticatedParentPanel() {
  // کلاس‌هایی که بازی دارند؛ فهرستِ ثابت با رسیدنِ محتوای تازه کهنه می‌شد
  const openGrades = useOpenGrades();
  const { user, logout } = useAuth();
  const [childId, setChildId] = useState<string>();
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingChild, setPendingChild] = useState<Child | null>(null);
  const [form, setForm] = useState({ phone: '', firstName: '', grade: '1', school: '', password: '' });

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { page, section, sectionId, go } = usePanelPage();

  // پیوندِ قدیمیِ «پشتیبانی پاسخ داد» (?open=support): حالا بخشِ پشتیبانی در تنظیمات
  useEffect(() => {
    if (params.get('open') !== 'support') return;
    const next = new URLSearchParams(params);
    next.delete('open');
    next.set('p', 'settings');
    next.set('s', 'support');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const children = useChildren();
  const notifications = useNotifications();
  const subscriptions = useSubscriptions();
  const preferences = usePreferences();
  const report = useReport(childId);
  const assignments = useAssignments(childId);
  const suggestions = useSuggestions(childId);

  const setAssignment = useSetAssignment(childId);
  const setPreferences = useSetPreferences();
  const addChild = useAddChild();
  const removeChild = useRemoveChild();
  const markRead = useMarkNotificationsRead();

  // اولین فرزند به‌صورت پیش‌فرض انتخاب می‌شود
  useEffect(() => {
    if (!childId && children.data?.length) setChildId(children.data[0].id);
  }, [children.data, childId]);

  // پیوندِ اعلان (?child=) فرزندِ همان اعلان را انتخاب می‌کند
  useEffect(() => {
    const wanted = params.get('child');
    if (!wanted || !children.data) return;
    const match = children.data.find((child) => String(child.id) === wanted);
    if (match) setChildId(match.id);
    const next = new URLSearchParams(params);
    next.delete('child');
    setParams(next, { replace: true });
  }, [params, setParams, children.data]);

  const activeChild = children.data?.find((child) => child.id === childId);
  const childName = activeChild
    ? `${activeChild.firstName} ${activeChild.lastName}`.trim() || 'فرزند شما'
    : 'فرزند شما';
  // در جمله‌های وسطِ متن، نامِ کوچک طبیعی‌تر است تا نام و نام‌خانوادگیِ کامل
  const shortName = activeChild?.firstName?.trim() || childName;

  const analysis = useMemo(
    () => (report.data ? (report.data.analysis ?? buildAnalysis(report.data, shortName)) : null),
    [report.data, shortName],
  );

  const parentName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  const unread = notifications.data?.unread ?? 0;

  const openNotifications = () => go('settings', { s: 'notifications' });
  const openSupport = () => go('settings', { s: 'support' });

  const pickGame = (suggestion: Suggestion, date: string) => {
    setAssignment.mutate(
      { gameSlug: suggestion.slug, date },
      {
        onSuccess: () => setToast(`بازی «${suggestion.title}» برای ${shortName} ثبت شد`),
        onError: () => setToast('ثبت بازی روز انجام نشد؛ دوباره تلاش کنید.'),
      },
    );
  };

  const togglePreference = (key: keyof ParentPreferences, value: boolean) => {
    setPreferences.mutate(
      { [key]: value },
      {
        onSuccess: () =>
          setToast(
            key === 'weeklyReport'
              ? value
                ? 'اعلان گزارش هفتگی روشن شد'
                : 'اعلان گزارش هفتگی خاموش شد'
              : value
                ? 'هشدارهای فعالیت روشن شد'
                : 'هشدارهای فعالیت خاموش شد',
          ),
      },
    );
  };

  const submitChild = () => {
    if (!isValidPhone(form.phone)) {
      setToast('شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.');
      return;
    }
    // رمز همان چیزی است که بچه‌های هم‌شماره را از هم جدا می‌کند؛
    // بدونِ آن حسابِ فرزند راهی برای ورود ندارد.
    if (form.password.trim().length < 6) {
      setToast('رمز باید دست‌کم ۶ نویسه باشد.');
      return;
    }
    addChild.mutate(
      {
        phone: normalizePhone(form.phone),
        password: form.password.trim(),
        firstName: form.firstName.trim() || undefined,
        grade: Number(form.grade),
        school: form.school.trim() || undefined,
      },
      {
        onSuccess: (child) => {
          setSheet(null);
          setForm({ phone: '', firstName: '', grade: '1', school: '', password: '' });
          setChildId(child.id);
          setToast('فرزند به حساب شما اضافه شد');
        },
        onError: (error: unknown) => {
          const detail =
            (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data
              ?.error?.message ?? 'افزودن فرزند انجام نشد.';
          setToast(detail);
        },
      },
    );
  };

  const confirmRemove = () => {
    if (!pendingChild) return;
    removeChild.mutate(pendingChild.id, {
      onSuccess: () => {
        setSheet(null);
        if (pendingChild.id === childId) setChildId(undefined);
        setPendingChild(null);
        setToast('دسترسی شما به این فرزند قطع شد');
      },
    });
  };

  const childPage = page === 'home' || page === 'health' || page === 'details' || page === 'daily';
  const showSwitcher = childPage && (children.data?.length ?? 0) > 1;
  const today = assignments.data?.find((item) => item.date === localDate(0)) ?? null;
  const upgrade = () => go('settings', { s: 'billing' });

  const settingsEnv: SettingsEnv = {
    guest: false,
    parentName,
    parentPhone: user?.phone ?? '',
    phoneVerified: Boolean(user?.phoneVerified),
    childList: children.data ?? [],
    activeChildId: childId,
    onChildChange: setChildId,
    subscriptions: subscriptions.data,
    notifications: notifications.data,
    onReadAll: () => markRead.mutate(),
    preferences: preferences.data,
    onToggle: togglePreference,
    onAddChild: () => setSheet('addChild'),
    onRemoveChild: (child) => {
      setPendingChild(child);
      setSheet('removeChild');
    },
    onLogout: () => setSheet('logout'),
    onNotice: setToast,
    open: (next, id, extra) => go('settings', { s: next || undefined, id, ...extra }),
    follow: (link) => navigate(link),
  };

  const noChildren = !children.isLoading && (children.data?.length ?? 0) === 0;
  let status: ReactNode;
  if (children.isLoading || (childId && report.isLoading)) status = <Skeleton />;
  else if (noChildren) {
    status = (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>هنوز فرزندی اضافه نکرده‌اید</p>
        <p className={styles.emptyText}>
          با شمارهٔ موبایلِ حساب فرزندتان او را اضافه کنید تا گزارش‌ها ساخته شوند.
        </p>
        <button type="button" className={styles.emptyBtn} onClick={() => setSheet('addChild')}>
          افزودن فرزند
        </button>
      </div>
    );
  } else if (report.isError && page !== 'daily') {
    status = (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>گزارش بارگذاری نشد</p>
        <p className={styles.emptyText}>اتصال را بررسی کنید و دوباره تلاش کنید.</p>
        <button type="button" className={styles.emptyBtn} onClick={() => report.refetch()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  return (
    <ParentShell
      page={page}
      onNavigate={go}
      parentName={parentName}
      parentPhone={user?.phone}
      childList={children.data ?? []}
      activeChildId={childId}
      onChildChange={setChildId}
      onAddChild={() => setSheet('addChild')}
      subscription={subscriptions.data?.find((item) => item.childId === childId)}
      childName={shortName}
      onSubscription={upgrade}
      unread={unread}
      onNotifications={openNotifications}
      onSupport={openSupport}
      onLogout={() => setSheet('logout')}
      overlays={<>
      <Sheet open={sheet === 'addChild'} title="افزودن فرزند" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>
          شمارهٔ موبایلی که فرزندتان با آن وارد لوکو می‌شود را بنویسید.
        </p>
        <label className={styles.field}>
          شمارهٔ موبایل
          <input
            dir="ltr"
            inputMode="numeric"
            placeholder="09xxxxxxxxx"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: normalizePhone(event.target.value) })}
          />
        </label>
        <label className={styles.field}>
          نام (اختیاری)
          <input
            value={form.firstName}
            onChange={(event) => setForm({ ...form, firstName: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          پایهٔ تحصیلی
          <select
            value={form.grade}
            onChange={(event) => setForm({ ...form, grade: event.target.value })}
          >
            {ALL_GRADES.map((grade) => (
              <option key={grade} value={grade} disabled={!openGrades.includes(grade)}>
                {gradeName(grade)}
                {!openGrades.includes(grade) ? ' — به‌زودی' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          رمز ورود فرزند
          <input
            type="text"
            autoComplete="off"
            placeholder="دست‌کم ۶ نویسه"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <small className={styles.hint}>
            با همین رمز وارد حسابش می‌شود. هر وقت خواستید از همین‌جا می‌بینید یا عوضش می‌کنید.
          </small>
        </label>
        <label className={styles.field}>
          مدرسه (اختیاری)
          <input
            value={form.school}
            onChange={(event) => setForm({ ...form, school: event.target.value })}
          />
        </label>
        <button
          type="button"
          className={styles.btnPrimary}
          disabled={addChild.isPending}
          onClick={submitChild}
        >
          {addChild.isPending ? 'در حال افزودن…' : 'افزودن فرزند'}
        </button>
      </Sheet>

      <Sheet open={sheet === 'removeChild'} title="حذف دسترسی" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>
          دسترسی شما به گزارش‌های{' '}
          <b>
            {pendingChild
              ? `${pendingChild.firstName} ${pendingChild.lastName}`.trim() || 'این فرزند'
              : ''}
          </b>{' '}
          قطع می‌شود. حساب و پیشرفتِ خودِ فرزندتان دست‌نخورده می‌ماند.
        </p>
        <div className={styles.btnRow}>
          <button
            type="button"
            className={styles.btnDanger}
            disabled={removeChild.isPending}
            onClick={confirmRemove}
          >
            <HiOutlineExclamationTriangle aria-hidden />
            حذف دسترسی
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => setSheet(null)}>
            انصراف
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'logout'} title="خروج از حساب" onClose={() => setSheet(null)}>
        <p className={styles.sheetText}>برای ادامهٔ کار باید دوباره وارد شوید. مطمئن هستید؟</p>
        <div className={styles.btnRow}>
          <button type="button" className={styles.btnDanger} onClick={logout}>
            خروج
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => setSheet(null)}>
            انصراف
          </button>
        </div>
      </Sheet>

      <Toast message={toast} onDone={() => setToast(null)} />
      </>}
    >
      {showSwitcher && (
        <div className={styles.mobileOnly}>
          <ChildSwitch items={children.data ?? []} activeId={childId} onChange={(id) => setChildId(id)} />
        </div>
      )}
      <PanelPages
        page={page}
        onNavigate={go}
        report={report.data}
        analysis={analysis}
        childName={shortName}
        today={today}
        onUpgrade={upgrade}
        onSupport={openSupport}
        status={status}
        daily={
          <DailyView
            childName={shortName}
            suggestions={suggestions.data?.suggestions ?? []}
            currentSlug={suggestions.data?.currentSlug ?? null}
            assignments={assignments.data ?? []}
            saving={setAssignment.isPending}
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

export default function ParentPanel() {
  const { user } = useAuth();
  const viewerId = user?.isGuest ? 'guest-parent' : user?.id || user?.phone || 'parent';

  return (
    <ParentIntroGate viewerId={viewerId}>
      {user?.isGuest ? <ParentGuestPanel /> : <AuthenticatedParentPanel />}
    </ParentIntroGate>
  );
}
