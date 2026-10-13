import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { pageFromParam } from './nav';
import type { PanelPage } from './nav';

/** صفحه‌ی فعلیِ پنل در نشانی (?p=) است تا دکمه‌ی برگشتِ مرورگر و پیوندِ مستقیم کار کند */
export function usePanelPage() {
  const [params, setParams] = useSearchParams();
  const page = pageFromParam(params.get('p'));
  const go = useCallback(
    (next: PanelPage) => {
      setParams((current) => {
        const sp = new URLSearchParams(current);
        if (next === 'home') sp.delete('p');
        else sp.set('p', next);
        return sp;
      });
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );
  return { page, go };
}
