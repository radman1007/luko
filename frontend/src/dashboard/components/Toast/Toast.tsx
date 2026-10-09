import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { HiOutlineCheckCircle, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import styles from './Toast.module.css';

import { ToastContext } from './toastContext';
import type { ToastTone } from './toastContext';

interface Item {
  id: number;
  text: string;
  tone: ToastTone;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const show = useCallback((text: string, tone: ToastTone = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, text, tone }]);
    window.setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), tone === 'error' ? 6000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.stack} aria-live="polite">
        {items.map((i) => (
          <div key={i.id} className={styles.toast} data-tone={i.tone} role={i.tone === 'error' ? 'alert' : 'status'}>
            {i.tone === 'ok' ? <HiOutlineCheckCircle aria-hidden /> : <HiOutlineExclamationTriangle aria-hidden />}
            {i.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
