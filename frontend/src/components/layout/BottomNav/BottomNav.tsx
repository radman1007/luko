import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/constants/nav';
import styles from './BottomNav.module.css';

export function BottomNav() {
  return (
    <nav className={styles.nav} aria-label="ناوبری اصلی">
      {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
        >
          <Icon className={styles.icon} aria-hidden />
          <span className={styles.label}>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
