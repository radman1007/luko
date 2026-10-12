import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { useCoverGoftino } from '@/features/support/useCoverGoftino';
import styles from './Sheet.module.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** شیتِ پایین‌کشو — اعلان‌ها، پشتیبانی، افزودن فرزند، تأییدها */
export function Sheet({ open, title, onClose, children }: Props) {
  useCoverGoftino(open);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={open ? styles.backdropShow : styles.backdrop}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={open ? styles.sheetShow : styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-hidden={!open}
      >
        <span className={styles.grab} aria-hidden />
        <header className={styles.head}>
          <b>{title}</b>
          <button type="button" className={styles.close} onClick={onClose} aria-label="بستن">
            <HiOutlineXMark aria-hidden />
          </button>
        </header>
        <div className={styles.body}>{open && children}</div>
      </div>
    </>
  );
}
