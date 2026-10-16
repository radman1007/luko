import type { ReactNode } from 'react';
import { HiOutlineBell } from 'react-icons/hi2';
import { LukoLogo } from '@/components/ui/LukoLogo/LukoLogo';
import { blockContextMenu } from '../../noCopy';
import { SubscriptionBadge } from '@/features/billing/components/SubscriptionBadge/SubscriptionBadge';
import type { ChildSubscription } from '@/features/billing/types';
import type { Child } from '../../types';
import { NAV_ITEMS, PAGE_TITLES, navKeyOf } from './nav';
import type { PanelPage } from './nav';
import { SideNav } from './SideNav';
import styles from './ParentShell.module.css';

export interface ShellProps {
  page: PanelPage;
  onNavigate: (page: PanelPage) => void;
  parentName: string;
  parentPhone?: string;
  childList: Child[];
  activeChildId?: string;
  onChildChange: (id: string) => void;
  onAddChild: () => void;
  /** اشتراکِ فرزندِ انتخاب‌شده */
  subscription?: ChildSubscription;
  childName: string;
  onSubscription: () => void;
  unread: number;
  onNotifications: () => void;
  onSupport: () => void;
  onLogout: () => void;
  /** نوارِ «حالتِ نمایشی» برای مهمان */
  banner?: ReactNode;
  /** شیت‌ها و پیام‌ها: بیرون از محتوای متحرک تا position: fixed درست بماند */
  overlays?: ReactNode;
  children: ReactNode;
}

/**
 * پوسته‌ی پنلِ والدین — کاملاً واکنش‌گرا:
 * گوشی و تبلت نوارِ بالا + منوی پایین دارند؛ از ۱۰۲۴px منوی کناریِ راست با اطلاعاتِ والد،
 * فرزندان و صفحه‌ها جای منوی پایین را می‌گیرد.
 */
export function ParentShell(props: ShellProps) {
  const { page, onNavigate, subscription, childName, onSubscription, unread, onNotifications, banner, overlays,
    children } = props;
  const active = navKeyOf(page);
  const bell = (
    <button type="button" className={styles.iconBtn} onClick={onNotifications}
      aria-label={unread ? `اعلان‌ها، ${unread.toLocaleString('fa-IR')} خوانده‌نشده` : 'اعلان‌ها'}>
      <HiOutlineBell aria-hidden />
      {unread > 0 && <span className={styles.dot} aria-hidden />}
    </button>
  );
  const badge = props.activeChildId ? (
    <SubscriptionBadge sub={subscription} childName={childName} onClick={onSubscription} />
  ) : null;

  return (
    <div className={styles.shell} onContextMenu={blockContextMenu}>
      <SideNav {...props} active={active} />

      <div className={styles.body}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}>
            <LukoLogo height={26} className={styles.logo} />
            <span className={styles.brandText}><b className={styles.srOnly}>لوکو</b><small>پنل والدین</small></span>
          </div>
          <div className={styles.pageTitle}>
            <h1>{PAGE_TITLES[page]}</h1>
          </div>
          <div className={styles.actions}>
            {badge}
            {bell}
          </div>
        </header>

        {banner}

        <main className={styles.content} id="parent-main">
          {children}
        </main>
      </div>

      <nav className={styles.tabbar} aria-label="بخش‌های پنل">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const on = item.key === active;
          return (
            <button key={item.key} type="button" className={styles.tab} data-active={on || undefined}
              aria-current={on ? 'page' : undefined} onClick={() => onNavigate(item.key)}>
              <span className={styles.tabIcon} aria-hidden><Icon /></span>
              <span className={styles.tabLabel}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {overlays}
    </div>
  );
}
