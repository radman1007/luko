import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * با هر تغییر مسیر، صفحه از بالای بالا باز می‌شود.
 * React Router به‌صورت پیش‌فرض موقعیت اسکرول را ریست نمی‌کند.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
