import type { ReactNode } from 'react';
import styles from './Board.module.css';

/**
 * چیدمانِ تبلت: از ۷۲۰px به بالا کارت‌های صفحه دو ستون می‌شوند.
 *
 * روی گوشی هیچ اثری ندارد — ستون‌ها بلوکِ ساده‌اند و فاصله‌ی کارت‌ها از
 * درونشان رد می‌شود، پس چیدمانِ گوشی همان قبلی می‌ماند. ترتیبِ DOM هم عوض
 * نمی‌شود؛ برای همین هر صفحه کارت‌هایش را طوری در ستون‌ها می‌گذارد که
 * ترتیبِ گوشی سرِ جایش بماند.
 */
export function Board({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`${styles.board} ${className}`}>{children}</div>;
}

interface ColumnProps {
  children: ReactNode;
  /**
   * start = ستونِ اول (راست)، end = ستونِ دوم (چپ)، wide = هر دو ستون.
   * کارتی که از ستونِ اول بلندتر است می‌تواند با کلاسِ صفحه چند ردیف بگیرد
   * (grid-row: span 2) تا زیرِ کارتِ کوتاه‌ترِ کناری جای خالی نماند.
   */
  side: 'start' | 'end' | 'wide';
  className?: string;
}

export function Column({ children, side, className = '' }: ColumnProps) {
  return <div className={`${styles.col} ${styles[side]} ${className}`}>{children}</div>;
}
