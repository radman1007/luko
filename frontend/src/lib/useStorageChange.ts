import { useEffect } from 'react';

/**
 * وقتی کلیدی از localStorage از جای دیگری عوض شد — داده‌ی دستگاهِ دیگرِ همین
 * حساب (`features/sync`)، بازیِ داخلِ iframe یا تبِ دیگر — دوباره بخوان.
 * `key === null` یعنی کلِ حافظه پاک شد.
 *
 * `matches` و `onChange` باید پایدار باشند (بیرونِ کامپوننت یا useCallback).
 */
export function useStorageChange(matches: (key: string) => boolean, onChange: () => void): void {
  useEffect(() => {
    const handler = (event: StorageEvent) => {
      if (event.key === null || matches(event.key)) onChange();
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [matches, onChange]);
}
