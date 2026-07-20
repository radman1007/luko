import type { ReactNode } from 'react';
import { BottomNav } from '@/components/layout/BottomNav/BottomNav';
import styles from './StudentLayout.module.css';

interface Props {
  children: ReactNode;
  /** کلاس تم بخش (متغیرهای --*-primary و --nav-accent) تا نویگیشن هم هم‌رنگ صفحه شود */
  className?: string;
}

/** قاب مشترک صفحه‌های دانش‌آموز: محتوای موبایل-محور + نویگیشن پایین */
export function StudentLayout({ children, className = '' }: Props) {
  return (
    <div className={`${styles.shell} ${className}`}>
      <div className={styles.content}>{children}</div>
      <BottomNav />
    </div>
  );
}
