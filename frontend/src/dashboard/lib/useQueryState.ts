import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * فیلترها و صفحه در نشانیِ صفحه می‌مانند: تازه‌کردن یا فرستادنِ پیوند، همان نما را باز
 * می‌کند. هر تغییرِ فیلتر صفحه را به ۱ برمی‌گرداند.
 */
export function useQueryState() {
  const [params, setParams] = useSearchParams();
  const values = Object.fromEntries(params.entries());

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, keepPage = false) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (!keepPage && !('page' in patch)) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  const active = [...params.keys()].filter((k) => k !== 'page' && k !== 'order').length;

  return { values, set, reset, active };
}
