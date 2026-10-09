import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { HiOutlineXMark } from 'react-icons/hi2';
import { Button } from '../Button/Button';
import styles from './Modal.module.css';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

/** پنجره‌ی روی صفحه؛ Escape و کلیک بیرون می‌بندد، فوکوس داخلش می‌رود */
export function Modal({ open, title, onClose, children, footer, wide }: Props) {
  const box = useRef<HTMLDivElement>(null);
  // onClose در هر رندرِ والد تازه است؛ اگر وابستگیِ اثر بود، با هر حرفِ تایپ‌شده
  // فوکوس به اولین فیلد برمی‌گشت. فقط باز/بسته‌شدن اثر را اجرا می‌کند.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return undefined;
    const before = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-close])')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      before?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={box}
        className={styles.box}
        data-wide={wide || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2>{title}</h2>
          <button type="button" data-close className={styles.close} onClick={onClose} aria-label="بستن">
            <HiOutlineXMark aria-hidden />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'تأیید', danger, busy, onConfirm, onClose }: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>انصراف</Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={styles.message}>{message}</div>
    </Modal>
  );
}
