import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { HiOutlineArrowRightOnRectangle, HiOutlineBars3, HiOutlineXMark } from 'react-icons/hi2';
import { useSession } from '../../features/auth/useSession';
import { NAV } from './nav';
import styles from './Shell.module.css';

/** قابِ داشبورد: منوی کناری (روی گوشی کشویی) + نوارِ بالا */
export function Shell({ children }: { children: ReactNode }) {
  const { me, can, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const items = NAV.filter((item) => can(item.need));

  return (
    <div className={styles.shell}>
      <aside className={styles.side} data-open={open || undefined} aria-label="منوی داشبورد">
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>L</span>
          <div>
            <b>لوکو</b>
            <small>داشبوردِ مدیریت</small>
          </div>
          <button type="button" className={styles.closeNav} onClick={() => setOpen(false)} aria-label="بستنِ منو">
            <HiOutlineXMark aria-hidden />
          </button>
        </div>
        <nav className={styles.nav}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) =>
              `${styles.link} ${isActive ? styles.active : ''}`}>
              <item.icon aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.me}>
          <span className={styles.avatar} aria-hidden>{me?.name?.charAt(0) ?? '?'}</span>
          <div className={styles.meText}>
            <b>{me?.name}</b>
            <small>{me?.title}</small>
          </div>
          <button type="button" className={styles.logout} onClick={() => void signOut()} aria-label="خروج" title="خروج">
            <HiOutlineArrowRightOnRectangle aria-hidden />
          </button>
        </div>
      </aside>
      {open && <div className={styles.scrim} onClick={() => setOpen(false)} aria-hidden />}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.menuBtn} onClick={() => setOpen(true)} aria-label="منو">
            <HiOutlineBars3 aria-hidden />
          </button>
          <b className={styles.topTitle}>داشبوردِ لوکو</b>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
