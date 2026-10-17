import type { KeyboardEvent, ReactNode } from 'react';
import { HiOutlinePaperAirplane } from 'react-icons/hi2';
import styles from './Composer.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  canSend: boolean;
  maxLength?: number;
  /** کادرِ بزرگِ بالای صفحه (یک خط، گرد) یا کادرِ گفت‌وگو */
  variant?: 'hero' | 'chat';
  label?: string;
  /** سمتِ چپِ کادر (دکمه‌ی انتخابِ مدل) */
  end?: ReactNode;
}

/**
 * کادرِ پرسش: نوشتن و فرستادن. دکمه‌ی فرستادن سمتِ راست است تا شستِ کاربر زودتر به آن برسد و انتخابِ مدل سمتِ
 * چپ (۲۶ مهر ۱۴۰۵، خواستِ کاربر؛ تایپِ صوتی هم فعلاً برداشته شد). روی لپ‌تاپ Enter می‌فرستد و Shift+Enter خطِ
 * تازه است؛ روی گوشی کیبورد خودش خطِ تازه می‌زند.
 */
export function Composer({
  value, onChange, onSend, placeholder, disabled = false, canSend, maxLength = 800, variant = 'chat', label = 'پرسش',
  end,
}: Props) {
  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.box} data-variant={variant}
        onSubmit={(event) => { event.preventDefault(); if (canSend) onSend(); }}>
        <button type="submit" className={styles.send} disabled={disabled || !canSend} aria-label="فرستادن">
          <HiOutlinePaperAirplane aria-hidden />
        </button>
        <textarea value={value} maxLength={maxLength} rows={1} disabled={disabled} onKeyDown={onKey}
          aria-label={label} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
        {end}
      </form>
    </div>
  );
}
