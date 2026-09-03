import { useEffect } from 'react';
import styles from './Toast.module.css';

interface Props {
  message: string | null;
  onDone: () => void;
}

/** پیامِ کوتاهِ پایین صفحه — بعد از هر عملِ موفق */
export function Toast({ message, onDone }: Props) {
  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(onDone, 2600);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  return (
    <div className={message ? styles.toastShow : styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
