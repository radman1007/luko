import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface Props {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}

export function PageHeader({ title, description, actions, back }: Props) {
  return (
    <header className={styles.head}>
      <div className={styles.texts}>
        {back}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.desc}>{description}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
