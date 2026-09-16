import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '@/lib/analytics';

/**
 * ثبتِ بازدیدِ صفحه در گوگل آنالیتیکس.
 *
 * مسیرِ روتر را می‌دهد، نه نشانیِ مرورگر: در این اپ صفحه بدونِ بارگذاریِ
 * تازه عوض می‌شود، پس بدونِ این، از هر نشست فقط یک بازدید ثبت می‌شد.
 * پرس‌وجو و هشِ نشانی عمداً نمی‌روند تا چیزی که نباید در آمار ننشیند.
 */
export function Analytics() {
  const { pathname } = useLocation();

  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  return null;
}
