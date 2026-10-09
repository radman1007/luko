import type { ReactNode } from 'react';
import styles from './Badge.module.css';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'violet' | 'gray' | 'teal';

interface Props {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  title?: string;
}

export function Badge({ tone = 'gray', children, dot, title }: Props) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {dot && <span className={styles.dot} aria-hidden />}
      {children}
    </span>
  );
}
