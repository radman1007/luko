import { useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { HiOutlineMicrophone, HiOutlinePaperAirplane, HiOutlineStopCircle } from 'react-icons/hi2';
import { useDictation } from './useDictation';
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
}

/**
 * کادرِ پرسش: نوشتن، گفتن (اگر مرورگر بتواند) و فرستادن. روی لپ‌تاپ Enter می‌فرستد و Shift+Enter خطِ تازه است؛
 * روی گوشی کیبورد خودش خطِ تازه می‌زند.
 */
export function Composer({
  value, onChange, onSend, placeholder, disabled = false, canSend, maxLength = 800, variant = 'chat', label = 'پرسش',
}: Props) {
  const valueRef = useRef(value);
  valueRef.current = value;
  const dictation = useDictation((text) => {
    if (!text) return;
    const current = valueRef.current.trim();
    onChange((current ? `${current} ${text}` : text).slice(0, maxLength));
  });

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && window.matchMedia('(pointer: fine)').matches) {
      event.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className={styles.wrap}>
      <form className={styles.box} data-variant={variant} data-listening={dictation.listening || undefined}
        onSubmit={(event) => { event.preventDefault(); if (canSend) onSend(); }}>
        <textarea value={dictation.listening && dictation.interim ? `${value} ${dictation.interim}`.trim() : value}
          maxLength={maxLength} rows={1} disabled={disabled} readOnly={dictation.listening} onKeyDown={onKey}
          aria-label={label}
          placeholder={dictation.listening ? 'در حالِ شنیدن… بگویید' : placeholder}
          onChange={(event) => onChange(event.target.value)} />
        {dictation.supported && (
          <button type="button" className={styles.mic} disabled={disabled}
            aria-label={dictation.listening ? 'پایانِ گفتن' : 'گفتنِ پرسش با صدا'} aria-pressed={dictation.listening}
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}>
            {dictation.listening ? <HiOutlineStopCircle aria-hidden /> : <HiOutlineMicrophone aria-hidden />}
          </button>
        )}
        <button type="submit" className={styles.send} disabled={disabled || !canSend} aria-label="فرستادن">
          <HiOutlinePaperAirplane aria-hidden />
        </button>
      </form>
      {dictation.error && <p className={styles.error} role="status">{dictation.error}</p>}
    </div>
  );
}
