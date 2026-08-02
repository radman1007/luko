import type { ReactNode } from 'react';
import styles from './PanelCard.module.css';

interface Props {
  title: string;
  subtitle?: string;
  /** گوشه‌ی بالا سمت چپ — فیلتر، برچسب، دکمه */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** قابِ مشترکِ همه‌ی کارت‌های پنل: عنوان + توضیح + محتوا */
export function PanelCard({ title, subtitle, action, children, className = '' }: Props) {
  return (
    <section className={`${styles.card} ${className}`}>
      <header className={styles.head}>
        <div className={styles.titles}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
