import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pageFromParam } from './nav';
import type { PanelPage } from './nav';

/** پارامترهایی که مالِ صفحه‌اند و با رفتن به صفحه‌ی دیگر پاک می‌شوند */
const PAGE_PARAMS = ['p', 's', 'id', 'plan', 'pay'];

/**
 * صفحه‌ی فعلیِ پنل در نشانی است تا دکمه‌ی برگشتِ مرورگر و پیوندِ مستقیم کار کند:
 * `?p=settings&s=ticket&id=12` یعنی تنظیمات ← پشتیبانی ← تیکتِ ۱۲.
 */
export function usePanelPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParam(params.get('p'));
  const section = params.get('s') ?? '';
  const sectionId = params.get('id') ?? '';
  const go = useCallback(
    (next: PanelPage, extra?: Record<string, string | undefined>) => {
      setParams((current) => {
        const sp = new URLSearchParams(current);
        PAGE_PARAMS.forEach((key) => sp.delete(key));
        if (next !== 'home') sp.set('p', next);
        Object.entries(extra ?? {}).forEach(([key, value]) => {
          if (value) sp.set(key, value);
        });
        return sp;
      });
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );
  return { page, section, sectionId, go };
}
