import { useEffect, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import styles from './OtpInput.module.css';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** وقتی همه‌ی رقم‌ها پر شد */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** قرمز شدنِ خانه‌ها وقتی کد غلط بود */
  invalid?: boolean;
}

/** ارقام فارسی/عربی → انگلیسی و حذفِ غیررقم */
function digits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '');
}

/**
 * کدِ یکبارمصرف، یک خانه برای هر رقم.
 *
 * خانه‌ها از چپ به راست پر می‌شوند چون عدد ذاتاً LTR است، حتی در صفحه‌ی
 * راست‌به‌چپ. چسباندنِ کلِ کد و پیشنهادِ خودکارِ پیامک هم کار می‌کند:
 * هرچه در یک خانه بیفتد بین خانه‌ها پخش می‌شود.
 */
export function OtpInput({ value, onChange, onComplete, length = 5, disabled, invalid }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const push = (next: string) => {
    const clean = digits(next).slice(0, length);
    onChange(clean);
    if (clean.length === length) {
      refs.current[length - 1]?.blur();
      onComplete?.(clean);
    }
    return clean;
  };

  const handleInput = (index: number, raw: string) => {
    const typed = digits(raw);
    if (!typed) return;

    // یک رقم → همان خانه؛ چند رقم (چسباندن یا پیشنهادِ پیامک) → از همین خانه پخش شود
    const next = (value.slice(0, index) + typed + value.slice(index + typed.length)).slice(0, length);
    const clean = push(next);
    const focusAt = Math.min(index + typed.length, length - 1);
    if (clean.length < length) refs.current[focusAt]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (value[index]) {
        // اول همین خانه خالی شود
        push(value.slice(0, index) + value.slice(index + 1));
      } else if (index > 0) {
        push(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
      return;
    }
    // در نمایشِ LTRِ خانه‌ها، کلیدِ چپ یعنی خانه‌ی قبلی
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const clean = push(event.clipboardData.getData('text'));
    refs.current[Math.min(clean.length, length - 1)]?.focus();
  };

  return (
    <div
      className={`${styles.boxes} ${invalid ? styles.invalid : ''}`}
      dir="ltr"
      role="group"
      aria-label={`کد ${length.toLocaleString('fa-IR')} رقمی`}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`${styles.box} ${value[i] ? styles.filled : ''}`}
          type="text"
          inputMode="numeric"
          // فقط خانه‌ی اول تا پیشنهادِ خودکارِ پیامک دوباره‌کاری نکند
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={value[i] ?? ''}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`رقم ${(i + 1).toLocaleString('fa-IR')}`}
        />
      ))}
    </div>
  );
}
