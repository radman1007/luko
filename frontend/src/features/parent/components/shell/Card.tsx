import type { ComponentType, ReactNode, SVGProps } from 'react';
import styles from './Card.module.css';

interface Props {
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  title?: string;
  note?: string;
  /** بدنه بدونِ padding — برای جدول و فهرست‌های تمام‌عرض */
  flush?: boolean;
  className?: string;
  children: ReactNode;
}

/** کارتِ پایه‌ی پنل: سربرگ با نشانِ آیکون + بدنه */
export function Card({ icon: Icon, title, note, flush, className = '', children }: Props) {
  return (
    <section className={`${styles.card} ${className}`}>
      {title && (
        <header className={styles.head}>
          {Icon && (
            <span className={styles.badge} aria-hidden>
              <Icon />
            </span>
          )}
          <div className={styles.titles}>
            <h3 className={styles.title}>{title}</h3>
            {note && <p className={styles.note}>{note}</p>}
          </div>
        </header>
      )}
      <div className={flush ? styles.bodyFlush : styles.body}>{children}</div>
    </section>
  );
}

/** تیترِ بینِ بخش‌ها با خطِ چین */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <p className={styles.sectionTitle}>{children}</p>;
}
