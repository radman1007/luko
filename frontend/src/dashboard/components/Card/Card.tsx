import type { ReactNode } from 'react';
import styles from './Card.module.css';

interface Props {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  padded?: boolean;
  className?: string;
}

export function Card({ title, description, actions, children, padded = true, className }: Props) {
  return (
    <section className={`${styles.card} ${className ?? ''}`}>
      {(title || actions) && (
        <header className={styles.head}>
          <div>
            {title && <h2 className={styles.title}>{title}</h2>}
            {description && <p className={styles.desc}>{description}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={padded ? styles.body : undefined}>{children}</div>
    </section>
  );
}
