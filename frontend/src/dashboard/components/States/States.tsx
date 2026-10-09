import type { ReactNode } from 'react';
import { HiOutlineExclamationTriangle, HiOutlineInbox } from 'react-icons/hi2';
import { Button } from '../Button/Button';
import styles from './States.module.css';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className={styles.box}>
      <HiOutlineInbox aria-hidden />
      <p>{children}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className={styles.box} role="alert">
      <HiOutlineExclamationTriangle aria-hidden data-tone="error" />
      <p>{message}</p>
      {onRetry && <Button size="sm" onClick={onRetry}>دوباره</Button>}
    </div>
  );
}

export function Loading({ label = 'در حالِ بارگذاری…' }: { label?: string }) {
  return (
    <div className={styles.box} aria-busy="true">
      <span className={styles.spinner} aria-hidden />
      <p>{label}</p>
    </div>
  );
}
